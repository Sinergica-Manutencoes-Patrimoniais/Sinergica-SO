-- 0027_E01-S24_tipos_tarefa.sql — Sinérgica SO
-- CRUD de Tipos de Tarefa no PCM, sincronizado com Auvo `/tasktypes` pelo motor E01-S22/S23.
--
-- Reverso:
--   drop trigger if exists trg_tipos_tarefa_auvo_enqueue on pcm.tipos_tarefa;
--   drop table if exists pcm.tipos_tarefa;

create table if not exists pcm.tipos_tarefa (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
  preenche_relato       boolean     not null default false,
  exige_assinatura      boolean     not null default false,
  fotos_minimas         int         not null default 0 check (fotos_minimas >= 0),
  ativo                 boolean     not null default true,
  auvo_id               bigint      unique,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create index if not exists idx_tipos_tarefa_deleted_nome
  on pcm.tipos_tarefa (deleted_at, nome);
create index if not exists idx_tipos_tarefa_auvo_id
  on pcm.tipos_tarefa (auvo_id);

alter table pcm.tipos_tarefa enable row level security;
alter table pcm.tipos_tarefa force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.tipos_tarefa to authenticated;
grant select, insert, update, delete on pcm.tipos_tarefa to service_role;

create policy "tipos_tarefa_select" on pcm.tipos_tarefa
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "tipos_tarefa_insert" on pcm.tipos_tarefa
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "tipos_tarefa_update" on pcm.tipos_tarefa
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_tipos_tarefa_auvo_enqueue
  after insert or update or delete on pcm.tipos_tarefa
  for each row execute function pcm.fn_auvo_enqueue('tipos_tarefa');
