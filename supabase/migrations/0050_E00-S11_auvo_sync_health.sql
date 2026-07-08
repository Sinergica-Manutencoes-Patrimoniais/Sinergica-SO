-- 0050_E00-S11_auvo_sync_health.sql — Sinérgica SO
-- Story E00-S11. Fecha o loop de feedback do motor de sync Auvo: hoje um descriptor com
-- `writeEnabled=false` ou um cron sem secret do Vault se comporta como sucesso silencioso (a linha
-- do outbox vira 'error' com uma mensagem, mas nada agrega isso por entidade nem expõe pra UI).
-- Ver specs/E00-S11-guarda-edge-functions/{spec.md,design ausente — tier pequeno}.
--
-- `write_enabled` vive no código TS (`_shared/auvo/registry/*.ts`), não no Postgres — não há como
-- uma view SQL pura lê-lo. Em vez de duplicar a fonte da verdade num config table mantido à mão,
-- `pcm-auvo-push` (ver próxima migration/deploy de E01-S36) faz upsert nesta tabela a cada linha
-- que processa, espelhando o estado real do registry no momento da execução — histórico honesto,
-- não uma cópia que pode divergir do código.
--
-- Reverso:
--   drop view if exists pcm.auvo_sync_health;
--   drop table if exists pcm.auvo_entity_status;

-- ─────────────────────────── ESPELHO DO REGISTRY (write_enabled) ───────────

create table if not exists pcm.auvo_entity_status (
  entity         text        primary key,
  write_enabled  boolean     not null,
  last_pull_ok_at timestamptz,
  last_error_at   timestamptz,
  last_error      text,
  updated_at     timestamptz not null default now()
);

alter table pcm.auvo_entity_status enable row level security;
alter table pcm.auvo_entity_status force  row level security;

-- Só service_role escreve (pcm-auvo-push faz upsert a cada drain) — mesmo padrão de auvo_sync_outbox.
grant select, insert, update on pcm.auvo_entity_status to service_role;

-- Leitura para quem tem acesso ao módulo PCM (badge de saúde de sync no header) — mesmo padrão de
-- pcm.funcionarios (0031). Sem policy de escrita para authenticated (defesa em profundidade).
grant select on pcm.auvo_entity_status to authenticated;

create policy "auvo_entity_status_select" on pcm.auvo_entity_status
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "auvo_entity_status_deny_write_authenticated" on pcm.auvo_entity_status
  for all to authenticated
  using (false)
  with check (false);

comment on table pcm.auvo_entity_status is
  'Espelho do write_enabled de cada AuvoEntityDescriptor (registry TS), atualizado por pcm-auvo-push '
  'a cada drain. Fonte da verdade continua sendo o código — esta tabela é só visibilidade (E00-S11).';

-- ─────────────────────────── VIEW DE SAÚDE POR ENTIDADE ────────────────────

-- SEM `security_invoker` (fica no padrão `false`, clássico) DE PROPÓSITO: `auvo_sync_outbox` nega
-- todo acesso de `authenticated` (AC-7 de E01-S22 — infraestrutura pura, zero acesso direto da
-- UI). Se a view rodasse com o privilégio de quem chama, o join contra a outbox devolveria zero
-- linhas para `authenticated` e a saúde de sync nunca apareceria. A view roda com o privilégio de
-- quem a CRIOU (este papel de migration), expõe só o agregado (timestamps/contagens/1 mensagem de
-- erro truncada) — nunca a linha crua da outbox — o que não viola o espírito de AC-7 (nenhum
-- SELECT/INSERT/UPDATE/DELETE direto na tabela; é uma disclosure controlada e agregada).
create or replace view pcm.auvo_sync_health as
select
  coalesce(s.entity, o.entity)                          as entity,
  s.write_enabled,
  s.updated_at                                            as write_enabled_checked_at,
  max(o.sent_at)          filter (where o.status = 'sent')  as last_push_ok_at,
  s.last_pull_ok_at,
  greatest(s.last_error_at, max(o.enqueued_at) filter (where o.status = 'error')) as last_error_at,
  case
    when s.last_error_at >= coalesce(max(o.enqueued_at) filter (where o.status = 'error'), '-infinity')
      then s.last_error
    else (array_agg(o.last_error order by o.enqueued_at desc)
      filter (where o.status = 'error'))[1]
  end as last_error,
  count(*)                filter (where o.status = 'pending')  as push_pending_count,
  count(*)                filter (where o.status = 'error')    as push_error_count
from pcm.auvo_entity_status s
full outer join pcm.auvo_sync_outbox o on o.entity = s.entity
where (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
)
group by coalesce(s.entity, o.entity), s.write_enabled, s.updated_at,
  s.last_pull_ok_at, s.last_error_at, s.last_error;

comment on view pcm.auvo_sync_health is
  'Saúde de sync Auvo por entidade (E00-S11): write_enabled real (espelhado de auvo_entity_status), '
  'últimos push/pull bem-sucedidos e erro mais recente. Consumível pela UI (badge no header PCM).';

grant select on pcm.auvo_sync_health to authenticated;
