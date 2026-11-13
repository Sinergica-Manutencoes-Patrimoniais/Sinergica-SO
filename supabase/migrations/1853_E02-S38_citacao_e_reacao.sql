-- 1853_E02-S38_citacao_e_reacao.sql — Sinérgica SO
-- Resposta citando mostra o que foi citado; reação do cliente aparece na mensagem reagida sem
-- acionar o Zé. Migration aditiva: `create or replace` em fn_registrar_mensagem_evolution (1848,
-- já em main) acrescenta um parâmetro novo com DEFAULT no final — assinatura antiga continua
-- chamável sem mudança nos callers existentes.
--
-- Reverso:
--   drop function if exists atendimento.fn_registrar_reacao_evolution(uuid,text,text);
--   drop function if exists atendimento.fn_pode_ler_conversa(uuid);
--   drop table if exists atendimento.reacoes_mensagem;
--   alter table atendimento.mensagens drop constraint if exists mensagens_citacao_valida;
--   alter table atendimento.mensagens
--     drop column if exists citada_mensagem_id, drop column if exists citada_remote_id,
--     drop column if exists citada_trecho, drop column if exists citada_autor;

alter table atendimento.mensagens
  add column if not exists citada_mensagem_id uuid references atendimento.mensagens(id) on delete set null,
  add column if not exists citada_remote_id   text,
  add column if not exists citada_trecho      text,
  add column if not exists citada_autor       text;

alter table atendimento.mensagens
  add constraint mensagens_citacao_valida check (
    (citada_remote_id is null and citada_trecho is null
      and citada_autor is null and citada_mensagem_id is null)
    or (direcao = 'entrada' and remetente_tipo = 'cliente'
        and length(btrim(citada_remote_id)) between 1 and 256
        and citada_autor in ('cliente', 'ze', 'humano', 'desconhecido')
        and (citada_trecho is null or length(citada_trecho) between 1 and 500))
  ) not valid;
alter table atendimento.mensagens validate constraint mensagens_citacao_valida;

create index if not exists idx_mensagens_citada on atendimento.mensagens (citada_mensagem_id)
  where citada_mensagem_id is not null;

-- Ponto único de permissão — mesma granularidade já usada em conversas_select/mensagens_select
-- (módulo atendimento, não por conversa individual — SPEC_DEVIATION já registrada em E02-S37).
create or replace function atendimento.fn_pode_ler_conversa(p_conversa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = atendimento, public
as $$
  select exists (select 1 from atendimento.conversas where id = p_conversa_id)
     and (
       auth.jwt() ->> 'user_role' = 'superadmin'
       or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
     )
$$;

revoke all on function atendimento.fn_pode_ler_conversa(uuid) from public, anon;
grant execute on function atendimento.fn_pode_ler_conversa(uuid) to authenticated, service_role;

-- Reação: uma por mensagem, só pela RPC (revoke inclusive de service_role para INSERT/UPDATE
-- direto — a escrita só acontece dentro da RPC security definer, prova de AC-10).
create table if not exists atendimento.reacoes_mensagem (
  mensagem_id   uuid        primary key references atendimento.mensagens(id) on delete cascade,
  conversa_id   uuid        not null references atendimento.conversas(id) on delete cascade,
  emoji         text        not null check (length(emoji) between 1 and 32),
  remote_id     text        not null check (length(btrim(remote_id)) between 1 and 256),
  atualizada_em timestamptz not null default clock_timestamp()
);
create index if not exists idx_reacoes_conversa on atendimento.reacoes_mensagem (conversa_id);

alter table atendimento.reacoes_mensagem enable row level security;
alter table atendimento.reacoes_mensagem force row level security;
revoke all on table atendimento.reacoes_mensagem from public, anon, authenticated, service_role;
grant select on table atendimento.reacoes_mensagem to authenticated;

create policy "reacoes_mensagem_leitura" on atendimento.reacoes_mensagem
  for select to authenticated using (atendimento.fn_pode_ler_conversa(conversa_id));

create or replace function atendimento.fn_registrar_reacao_evolution(
  p_canal_id uuid,
  p_remote_id_reagido text,
  p_emoji text
) returns text  -- 'aplicada' | 'removida' | 'orfa'
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_mensagem_id uuid;
  v_conversa_id uuid;
begin
  select m.id, m.conversa_id into v_mensagem_id, v_conversa_id
    from atendimento.mensagens m
    join atendimento.conversas c on c.id = m.conversa_id
   where c.canal_id = p_canal_id and m.wa_message_id = p_remote_id_reagido
   limit 1;
  if v_mensagem_id is null then return 'orfa'; end if;

  if btrim(coalesce(p_emoji, '')) = '' then
    delete from atendimento.reacoes_mensagem where mensagem_id = v_mensagem_id;
    return 'removida';
  end if;

  insert into atendimento.reacoes_mensagem (mensagem_id, conversa_id, emoji, remote_id)
  values (v_mensagem_id, v_conversa_id, p_emoji, p_remote_id_reagido)
  on conflict (mensagem_id) do update
    set emoji = excluded.emoji, atualizada_em = clock_timestamp();
  return 'aplicada';
end;
$$;

revoke all on function atendimento.fn_registrar_reacao_evolution(uuid, text, text) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_reacao_evolution(uuid, text, text) to service_role;

-- `create or replace` com parâmetro NOVO não substitui a função antiga — cria uma SEGUNDA
-- sobrecarga (7 params vs. 8 com default), e uma chamada com 7 argumentos fica ambígua entre as
-- duas (achado pelo CI: "function ... is not unique"). Precisa dropar a assinatura de 7 params
-- primeiro para sobrar só uma função, chamável com 7 ou 8 argumentos.
drop function if exists atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text
);

-- Resolve a citação DENTRO do mesmo canal (nunca globalmente); não achou = citada_mensagem_id
-- null, citada_autor = 'desconhecido' (AC-2 — mostra "mensagem anterior" do lado da UI).
create or replace function atendimento.fn_registrar_mensagem_evolution(
  p_canal_id uuid,
  p_event_type text,
  p_remote_id text,
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_citada_remote_id text default null
) returns table (mensagem_id uuid, conversa_id uuid, duplicado boolean)
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_inserted_message_id uuid;
  v_citada_id uuid;
  v_citada_autor text;
begin
  insert into atendimento.evolution_inbox (canal_id, event_type, remote_message_id)
  values (p_canal_id, p_event_type, p_remote_id)
  on conflict do nothing;
  if not found then
    return query select null::uuid, null::uuid, true;
    return;
  end if;

  select client_id into v_client_id
    from atendimento.config_ze where group_jid = p_remote_jid limit 1;

  insert into atendimento.conversas (instance_id, remote_jid, client_id, canal_id)
  values (p_instance_id, p_remote_jid, v_client_id, p_canal_id)
  on conflict (instance_id, remote_jid) do update
    set canal_id = coalesce(atendimento.conversas.canal_id, excluded.canal_id)
  returning id into v_conversa_id;

  if p_citada_remote_id is not null then
    select m.id, case
        when m.direcao = 'entrada' then 'cliente'
        when m.remetente_tipo in ('ze', 'agente') then 'ze'
        else 'humano' end
      into v_citada_id, v_citada_autor
      from atendimento.mensagens m
     where m.conversa_id = v_conversa_id and m.wa_message_id = p_citada_remote_id
     limit 1;
    if v_citada_autor is null then v_citada_autor := 'desconhecido'; end if;
  end if;

  insert into atendimento.mensagens (
    conversa_id, direcao, remetente_tipo, conteudo, wa_message_id, canal_id,
    citada_mensagem_id, citada_remote_id, citada_autor
  )
  values (
    v_conversa_id, 'entrada', 'cliente', p_conteudo, p_remote_id, p_canal_id,
    v_citada_id, p_citada_remote_id, v_citada_autor
  )
  on conflict do nothing
  returning id into v_inserted_message_id;

  if v_inserted_message_id is not null then
    update atendimento.conversas
    set nao_lidas = nao_lidas + 1,
        ultima_mensagem_preview = left(p_conteudo, 200),
        ultima_mensagem_em = now(),
        updated_at = now()
    where id = v_conversa_id;
  end if;

  return query select v_inserted_message_id, v_conversa_id, false;
end;
$$;

-- A assinatura mudou (7 -> 8 params); GRANT não migra entre assinaturas diferentes, e Postgres
-- concede EXECUTE a PUBLIC por padrão em função nova — sem isto, anon/authenticated chamariam
-- a RPC direto via PostgREST.
revoke all on function atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text, text
) to service_role;

comment on function atendimento.fn_registrar_reacao_evolution(uuid, text, text) is
  'E02-S38: reação do cliente — aplicada/removida/órfã. Nunca cria mensagem nem toca prévia/nao_lidas (reação não aciona o Zé).';
