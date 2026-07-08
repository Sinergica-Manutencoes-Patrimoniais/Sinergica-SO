-- 0039_E02-S01_atendimento_conversas_mensagens.sql — Sinérgica SO
-- Fundação do Inbox de Atendimento (épica E02): registro de conversa/mensagem que sobrevive além
-- do ciclo de vida efêmero de `atendimento.wa_queue` (fila de debounce por rajada do Agente Zé).
-- `wa_messages`/`wa_queue`/`config_ze` continuam existindo exatamente como estão — esta migration
-- não altera nenhuma delas, só adiciona as tabelas novas que o Inbox humano (E02-S02) vai ler.
--
-- `conversas.modo` é um override POR CONVERSA, distinto de `config_ze.modo` (que é por
-- condomínio) — humano assumir 1 conversa não deve pausar a automação do condomínio inteiro. Ver
-- specs/E02-S01-atendimento-fundacao/design.md.
--
-- Reverso:
--   drop function if exists atendimento.fn_registrar_mensagem_entrada(text,text,text,text,text);
--   drop table if exists atendimento.mensagens;
--   drop table if exists atendimento.conversas;

create table if not exists atendimento.conversas (
  id                      uuid        primary key default gen_random_uuid(),
  client_id               uuid        references pcm.clientes,
  canal                   text        not null default 'whatsapp' check (canal in ('whatsapp')),
  instance_id             text        not null,
  remote_jid              text        not null,
  contato_nome            text,
  status                  text        not null default 'aberta' check (status in ('aberta', 'pendente', 'encerrada')),
  modo                    text        not null default 'auto' check (modo in ('auto', 'pausado')),
  atribuido_a             uuid        references auth.users,
  nao_lidas               int         not null default 0,
  ultima_mensagem_preview text,
  ultima_mensagem_em      timestamptz,
  ordem_servico_id        uuid        references pcm.ordens_servico(id),
  tags                    text[]      not null default '{}',
  created_at              timestamptz not null default now(),
  created_by              uuid        references auth.users,
  updated_at              timestamptz,
  updated_by              uuid        references auth.users,
  unique (instance_id, remote_jid)
);

create table if not exists atendimento.mensagens (
  id             uuid        primary key default gen_random_uuid(),
  conversa_id    uuid        not null references atendimento.conversas(id),
  direcao        text        not null check (direcao in ('entrada', 'saida')),
  remetente_tipo text        not null check (remetente_tipo in ('cliente', 'ze', 'humano')),
  remetente_id   uuid        references auth.users,
  conteudo       text,
  tipo_conteudo  text        not null default 'texto' check (tipo_conteudo in ('texto', 'sistema')),
  wa_message_id  text        unique,
  status_entrega text        check (status_entrega in ('enviando', 'enviado', 'erro')),
  erro_detalhe   text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_conversas_status_atividade
  on atendimento.conversas (status, ultima_mensagem_em desc);
create index if not exists idx_conversas_atribuido
  on atendimento.conversas (atribuido_a);
create index if not exists idx_mensagens_conversa_created
  on atendimento.mensagens (conversa_id, created_at);

alter table atendimento.conversas enable row level security;
alter table atendimento.conversas force row level security;
alter table atendimento.mensagens enable row level security;
alter table atendimento.mensagens force row level security;

grant usage on schema atendimento to authenticated, service_role;
grant select, insert, update on atendimento.conversas to authenticated;
grant select, insert, update, delete on atendimento.conversas to service_role;
grant select, insert, update on atendimento.mensagens to authenticated;
grant select, insert, update, delete on atendimento.mensagens to service_role;

create policy "conversas_select" on atendimento.conversas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "conversas_insert" on atendimento.conversas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "conversas_update" on atendimento.conversas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "mensagens_select" on atendimento.mensagens
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "mensagens_insert" on atendimento.mensagens
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "mensagens_update" on atendimento.mensagens
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

-- Upsert atômico de conversa (resolve client_id via config_ze.group_jid, incrementa nao_lidas
-- sem race condition) + insert idempotente da mensagem de entrada, numa única chamada do webhook
-- (pcm-whatsapp-webhook). security definer: só service_role invoca.
create or replace function atendimento.fn_registrar_mensagem_entrada(
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_wa_message_id text
) returns uuid
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_inserted_message_id uuid;
begin
  select client_id into v_client_id
    from atendimento.config_ze
    where group_jid = p_remote_jid
    limit 1;

  -- Conversa é sempre resolvida/criada primeiro, sem tocar nos contadores — evita que uma
  -- reentrega (retry de rede do Evolution) da MESMA mensagem infle nao_lidas/preview (a mensagem
  -- em si é dedupe por wa_message_id logo abaixo; os contadores só devem mudar se ela for
  -- genuinamente nova).
  insert into atendimento.conversas (instance_id, remote_jid, client_id, contato_nome)
  values (p_instance_id, p_remote_jid, v_client_id, p_contato_nome)
  on conflict (instance_id, remote_jid) do update
  set contato_nome = coalesce(atendimento.conversas.contato_nome, excluded.contato_nome)
  returning id into v_conversa_id;

  insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo, wa_message_id)
  values (v_conversa_id, 'entrada', 'cliente', p_conteudo, p_wa_message_id)
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

  return v_conversa_id;
end;
$$;

revoke all on function atendimento.fn_registrar_mensagem_entrada(text, text, text, text, text) from public;
grant execute on function atendimento.fn_registrar_mensagem_entrada(text, text, text, text, text) to service_role;
