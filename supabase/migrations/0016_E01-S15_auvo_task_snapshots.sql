-- 0016_E01-S15_auvo_task_snapshots.sql — Sinérgica SO
-- Story E01-S15. Snapshot read-only do payload rico recebido no webhook de Task do Auvo.
--
-- Decisão de escopo: anexos/fotos NÃO são copiados para Supabase Storage. A tabela guarda apenas
-- metadados/URLs/referências recebidas do Auvo e o payload bruto em JSONB.

create table if not exists pcm.auvo_task_snapshots (
  id                         uuid        primary key default gen_random_uuid(),
  ordem_servico_id            uuid        not null references pcm.ordens_servico (id) on delete cascade,
  auvo_task_id                bigint      not null,
  payload_raw                 jsonb       not null default '{}'::jsonb,
  relato_usuario              text,
  anexos                      jsonb       not null default '[]'::jsonb,
  checklist                   jsonb       not null default '[]'::jsonb,
  pecas_consumidas            jsonb       not null default '[]'::jsonb,
  controle_horas              jsonb       not null default '{}'::jsonb,
  timeline                    jsonb       not null default '{}'::jsonb,
  recebida_em                 timestamptz,
  visualizada_em              timestamptz,
  checkin_em                  timestamptz,
  checkout_em                 timestamptz,
  concluida_em                timestamptz,
  last_webhook_received_at    timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index if not exists uq_auvo_task_snapshots_task
  on pcm.auvo_task_snapshots (auvo_task_id);

create index if not exists idx_auvo_task_snapshots_os
  on pcm.auvo_task_snapshots (ordem_servico_id);

alter table pcm.auvo_task_snapshots enable row level security;
alter table pcm.auvo_task_snapshots force row level security;

grant select on pcm.auvo_task_snapshots to authenticated;
grant select, insert, update, delete on pcm.auvo_task_snapshots to service_role;

create policy "auvo_task_snapshots_select" on pcm.auvo_task_snapshots
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "auvo_task_snapshots_deny_insert" on pcm.auvo_task_snapshots
  for insert to authenticated with check (false);
create policy "auvo_task_snapshots_deny_update" on pcm.auvo_task_snapshots
  for update to authenticated using (false);
create policy "auvo_task_snapshots_deny_delete" on pcm.auvo_task_snapshots
  for delete to authenticated using (false);
