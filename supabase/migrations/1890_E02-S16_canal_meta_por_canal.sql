-- 1890_E02-S16_canal_meta_por_canal.sql — Sinérgica SO
-- Instagram Direct (e o resto da Meta) passa a usar o MESMO modelo de canal da E02-S35..S41
-- (ADR-1687), em vez do caminho de segredo global que a E02-S16 tinha deixado: `META_APP_SECRET`
-- único em env para todas as contas, `META_ACCESS_TOKEN` único para todo envio, e `verify_token`
-- em CLARO numa coluna que `authenticated` lê. Decisão: ADR-1700 (reverte a decisão de 12/11 que
-- deixava o Instagram fora do porte).
--
-- O que esta migration faz, em ordem:
--   1. `provedor` passa a reconhecer 'meta-instagram' e 'meta-messenger' (hoje caem em
--      'desconhecido', por falta de mapeamento — ver 1845).
--   2. `atendimento.meta_canal`: refs opacas do Vault por canal (app secret, token, verify token)
--      + versão do Graph. Espelha `atendimento.evolution_instancia`, só service_role toca.
--   3. `verify_token` de `canais_externos` deixa de guardar segredo (esvaziada + check null).
--   4. `fn_registrar_mensagem_meta`: ingestão canônica por canal, idempotente em
--      `atendimento.evolution_inbox` — a MESMA tabela, porque a chave `(canal, evento, id)` já é
--      genérica. Criar um segundo inbox só pra Meta seria duplicar sistema existente.
--
-- Reverso:
--   drop function if exists atendimento.fn_registrar_mensagem_meta(uuid,text,text,text,text,text,text,text);
--   alter table atendimento.canais_externos drop constraint if exists canais_externos_verify_token_sem_segredo;
--   drop table if exists atendimento.meta_canal;
--   alter table atendimento.canais_externos drop constraint if exists canais_externos_provedor_valido;
--   alter table atendimento.canais_externos add constraint canais_externos_provedor_valido
--     check (provedor in ('evolution-api','meta-whatsapp','desconhecido'));

-- ─────────────────────────── 1. provedor Meta explícito ───────────────────────────
alter table atendimento.canais_externos
  drop constraint if exists canais_externos_provedor_valido;

alter table atendimento.canais_externos
  add constraint canais_externos_provedor_valido check (
    provedor in (
      'evolution-api', 'meta-whatsapp', 'meta-instagram', 'meta-messenger', 'desconhecido'
    )
  ) not valid;

update atendimento.canais_externos
   set provedor = case tipo
         when 'instagram' then 'meta-instagram'
         when 'messenger' then 'meta-messenger'
         else provedor end
 where tipo in ('instagram', 'messenger')
   and provedor = 'desconhecido';

alter table atendimento.canais_externos validate constraint canais_externos_provedor_valido;

-- Mapeamento 1:1 determinístico no INSERT (mesma regra da 1845, que já cobria evolution/meta_wa).
create or replace function atendimento.fn_derivar_provedor_do_tipo()
returns trigger
language plpgsql
as $$
begin
  new.provedor := case
    when new.tipo = 'evolution' then 'evolution-api'
    when new.tipo = 'meta_wa'   then 'meta-whatsapp'
    when new.tipo = 'instagram' then 'meta-instagram'
    when new.tipo = 'messenger' then 'meta-messenger'
    else new.provedor
  end;
  return new;
end;
$$;

-- ─────────────────────────── 2. credenciais por canal, no Vault ───────────────────────────
-- Nenhum VALOR de segredo aqui: só a referência opaca que `config.fn_ler_segredo_referenciado`
-- (1847) aceita. Mesma forma de `atendimento.evolution_instancia`.
create table if not exists atendimento.meta_canal (
  canal_id          uuid primary key references atendimento.canais_externos(id) on delete cascade,
  conta_externa_id  text not null check (conta_externa_id ~ '^[0-9]{1,64}$'),
  app_secret_ref    text,
  token_ref         text,
  verify_token_ref  text,
  graph_version     text not null default 'v22.0' check (graph_version ~ '^v[0-9]+\.[0-9]+$'),
  estado            text not null default 'sem_credencial' check (
                      estado in ('sem_credencial', 'configurado', 'conectado', 'erro')),
  indicio_token     text check (length(indicio_token) <= 4),
  atualizado_por    uuid references auth.users,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz
);

alter table atendimento.meta_canal enable row level security;
alter table atendimento.meta_canal force row level security;
revoke all on table atendimento.meta_canal from public, anon, authenticated;
grant select, insert, update, delete on table atendimento.meta_canal to service_role;

create index if not exists idx_meta_canal_conta on atendimento.meta_canal (conta_externa_id);

comment on table atendimento.meta_canal is
  'E02-S16/ADR-1700: credenciais Meta POR CANAL, só por referência opaca ao Vault. authenticated não lê.';
comment on column atendimento.meta_canal.app_secret_ref is
  'Referência opaca ao app secret usado para conferir X-Hub-Signature-256 DAQUELE canal.';
comment on column atendimento.meta_canal.indicio_token is
  'Últimos 4 caracteres do token, só para o operador reconhecer qual geração está no ar. Nunca o valor.';

-- ─────────────────────────── 3. segredo sai da tabela que authenticated lê ───────────────────────────
-- `canais_externos.verify_token` nasceu em 0057 guardando o token de verificação do webhook EM
-- CLARO, numa tabela cuja policy de SELECT libera qualquer usuário com `atendimento` em leitura.
-- Não dá para migrar o valor: não há prova de qual app ele serve (ADR-1700, "o que isto custa").
update atendimento.canais_externos set verify_token = null where verify_token is not null;

alter table atendimento.canais_externos
  add constraint canais_externos_verify_token_sem_segredo check (verify_token is null) not valid;
alter table atendimento.canais_externos validate constraint canais_externos_verify_token_sem_segredo;

comment on column atendimento.canais_externos.verify_token is
  'DESCONTINUADA (ADR-1700). Sempre null: o verify token vive no Vault, apontado por meta_canal.verify_token_ref.';

-- ─────────────────────────── 4. ingestão Meta por canal, idempotente ───────────────────────────
comment on table atendimento.evolution_inbox is
  'E02-S36/ADR-1700: chave de idempotência (canal_id, event_type, remote_message_id) de TODO webhook de canal — Evolution e Meta. Nome legado; serve os dois. Só service_role.';

-- `p_canal_id` já vem resolvido pela ROTA do webhook e autenticado por assinatura; a RPC nunca
-- confia num canal vindo do corpo do evento (ADR-1687). Reserva o inbox ANTES de tocar
-- conversa/mensagem — falha em qualquer ponto libera a reserva por rollback.
create or replace function atendimento.fn_registrar_mensagem_meta(
  p_canal_id uuid,
  p_event_type text,
  p_remote_id text,
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_canal text
) returns table (mensagem_id uuid, conversa_id uuid, duplicado boolean)
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_inserted_message_id uuid;
begin
  if p_canal not in ('whatsapp', 'instagram', 'messenger') then
    raise exception 'canal_invalido' using errcode = '22023';
  end if;

  insert into atendimento.evolution_inbox (canal_id, event_type, remote_message_id)
  values (p_canal_id, p_event_type, p_remote_id)
  on conflict do nothing;
  if not found then
    return query select null::uuid, null::uuid, true;
    return;
  end if;

  insert into atendimento.conversas (
    instance_id, remote_jid, contato_nome, canal, provedor, canal_id
  ) values (
    p_instance_id, p_remote_jid, p_contato_nome, p_canal, 'meta', p_canal_id
  )
  on conflict (instance_id, remote_jid) do update
  set contato_nome = coalesce(atendimento.conversas.contato_nome, excluded.contato_nome),
      canal        = excluded.canal,
      provedor     = excluded.provedor,
      canal_id     = coalesce(atendimento.conversas.canal_id, excluded.canal_id)
  returning id into v_conversa_id;

  insert into atendimento.mensagens (
    conversa_id, direcao, remetente_tipo, conteudo, wa_message_id, canal_id
  ) values (
    v_conversa_id, 'entrada', 'cliente', p_conteudo, p_remote_id, p_canal_id
  )
  on conflict (wa_message_id) do nothing
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

revoke all on function atendimento.fn_registrar_mensagem_meta(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_meta(
  uuid, text, text, text, text, text, text, text
) to service_role;

comment on function atendimento.fn_registrar_mensagem_meta(
  uuid, text, text, text, text, text, text, text
) is 'E02-S16/ADR-1700: ingestão Meta por canal. Reserva evolution_inbox antes de tocar conversa/mensagem.';
