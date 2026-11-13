-- 1848_E02-S36_evolution_inbox_canal.sql — Sinérgica SO
-- Webhook Evolution por canal (ADR-1687). Hoje `pcm-whatsapp-webhook` valida token GLOBAL numa
-- rota fixa e resolve a instância pelo CORPO do evento — quem conhece o token de um número
-- escreve PII na conversa de qualquer outro, e um evento forjado escolhe a instância (achado em
-- docs/planejamento/port-evolution-triviatende.md, c.1/c.2). Esta migration prepara o schema
-- para o webhook novo, por canal: inbox idempotente escopado, `canal_id` em conversas/mensagens,
-- e idempotência de mensagem que não colide entre canais diferentes.
--
-- Reverso:
--   drop index if exists idx_mensagens_wa_message_id_canal;
--   drop index if exists idx_mensagens_wa_message_id_sem_canal;
--   alter table atendimento.mensagens add constraint mensagens_wa_message_id_key unique (wa_message_id);
--   alter table atendimento.mensagens drop column if exists canal_id;
--   alter table atendimento.conversas drop column if exists canal_id;
--   drop table if exists atendimento.evolution_inbox;

create table if not exists atendimento.evolution_inbox (
  canal_id          uuid not null references atendimento.canais_externos(id) on delete cascade,
  event_type        text not null check (length(event_type) between 1 and 60),
  remote_message_id text not null check (length(remote_message_id) between 1 and 120),
  recebido_em       timestamptz not null default now(),
  primary key (canal_id, event_type, remote_message_id)
);

alter table atendimento.evolution_inbox enable row level security;
alter table atendimento.evolution_inbox force row level security;
revoke all on table atendimento.evolution_inbox from public, anon, authenticated;
grant select, insert, delete on table atendimento.evolution_inbox to service_role;

alter table atendimento.conversas
  add column if not exists canal_id uuid references atendimento.canais_externos(id);
alter table atendimento.mensagens
  add column if not exists canal_id uuid references atendimento.canais_externos(id);

-- Backfill por match de instance_id ↔ identificador_externo (mesma forma que já funciona hoje
-- na função legada `obterConfiguracaoEvolution` — não inventa relação nova).
update atendimento.conversas c
   set canal_id = ce.id
  from atendimento.canais_externos ce
 where ce.tipo = 'evolution'
   and ce.identificador_externo = c.instance_id
   and c.canal_id is null;

update atendimento.mensagens m
   set canal_id = c.canal_id
  from atendimento.conversas c
 where c.id = m.conversa_id
   and c.canal_id is not null
   and m.canal_id is null;

create index if not exists idx_conversas_canal on atendimento.conversas (canal_id);
create index if not exists idx_mensagens_canal on atendimento.mensagens (canal_id);

-- Idempotência de mensagem deixa de ser global: dois canais podem, em teoria, receber o mesmo
-- remote_message_id da Evolution (AC-5) — a unicidade passa a ser POR CANAL. Linha legada sem
-- canal_id (Meta WA, por ex.) mantém a garantia global de antes, numa segunda partial index.
alter table atendimento.mensagens drop constraint if exists mensagens_wa_message_id_key;

create unique index if not exists idx_mensagens_wa_message_id_canal
  on atendimento.mensagens (canal_id, wa_message_id)
  where canal_id is not null and wa_message_id is not null;

create unique index if not exists idx_mensagens_wa_message_id_sem_canal
  on atendimento.mensagens (wa_message_id)
  where canal_id is null and wa_message_id is not null;

comment on table atendimento.evolution_inbox is
  'E02-S36: chave de idempotência (canal_id, event_type, remote_message_id) do webhook por canal. Só service_role.';
comment on column atendimento.conversas.canal_id is
  'E02-S36: canal resolvido pelo SERVIDOR a partir da rota do webhook — nunca do corpo do evento.';

-- RPC do webhook novo: reserva no inbox ANTES de tocar conversa/mensagem — falha em qualquer
-- ponto libera a reserva por rollback (sem linha órfã). `canal_id` já vem resolvido e autenticado
-- pelo handler (ADR-1687); a RPC nunca confia num canal_id vindo do corpo do evento.
create or replace function atendimento.fn_registrar_mensagem_evolution(
  p_canal_id uuid,
  p_event_type text,
  p_remote_id text,
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text
) returns table (mensagem_id uuid, conversa_id uuid, duplicado boolean)
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_inserted_message_id uuid;
begin
  insert into atendimento.evolution_inbox (canal_id, event_type, remote_message_id)
  values (p_canal_id, p_event_type, p_remote_id)
  on conflict do nothing;
  if not found then
    return query select null::uuid, null::uuid, true;
    return;
  end if;

  select client_id into v_client_id
    from atendimento.config_ze
    where group_jid = p_remote_jid
    limit 1;

  insert into atendimento.conversas (instance_id, remote_jid, client_id, contato_nome, canal_id)
  values (p_instance_id, p_remote_jid, v_client_id, p_contato_nome, p_canal_id)
  on conflict (instance_id, remote_jid) do update
  set contato_nome = coalesce(atendimento.conversas.contato_nome, excluded.contato_nome),
      canal_id = coalesce(atendimento.conversas.canal_id, excluded.canal_id)
  returning id into v_conversa_id;

  insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo, wa_message_id, canal_id)
  values (v_conversa_id, 'entrada', 'cliente', p_conteudo, p_remote_id, p_canal_id)
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

revoke all on function atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text
) to service_role;

-- Rate limit por canal (AC-12) — reusa a RPC já existente, só muda a chave.
comment on function atendimento.fn_registrar_mensagem_evolution(
  uuid, text, text, text, text, text, text
) is 'E02-S36: ingestão canônica por canal. Reserva inbox ANTES de tocar conversa/mensagem.';
