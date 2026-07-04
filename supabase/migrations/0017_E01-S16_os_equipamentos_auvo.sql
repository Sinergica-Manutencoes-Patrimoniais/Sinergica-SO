-- 0017_E01-S16_os_equipamentos_auvo.sql — Sinérgica SO
-- Story E01-S16. Relacionamento entre OS do PCM e equipamento Auvo.
--
-- O Auvo continua dono dos atributos do equipamento (identificador, categoria, garantia, ficha
-- técnica). Esta tabela guarda apenas o relacionamento que pertence ao domínio PCM.

create table if not exists pcm.os_equipamentos_auvo (
  id                  uuid        primary key default gen_random_uuid(),
  ordem_servico_id     uuid        not null references pcm.ordens_servico (id) on delete cascade,
  auvo_equipment_id   bigint      not null,
  source              text        not null default 'auvo_webhook',
  payload_ref         jsonb       not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists uq_os_equipamentos_auvo_os_equipment
  on pcm.os_equipamentos_auvo (ordem_servico_id, auvo_equipment_id);

create index if not exists idx_os_equipamentos_auvo_equipment
  on pcm.os_equipamentos_auvo (auvo_equipment_id);

alter table pcm.os_equipamentos_auvo enable row level security;
alter table pcm.os_equipamentos_auvo force row level security;

grant select on pcm.os_equipamentos_auvo to authenticated;
grant select, insert, update, delete on pcm.os_equipamentos_auvo to service_role;

create policy "os_equipamentos_auvo_select" on pcm.os_equipamentos_auvo
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "os_equipamentos_auvo_deny_insert" on pcm.os_equipamentos_auvo
  for insert to authenticated with check (false);
create policy "os_equipamentos_auvo_deny_update" on pcm.os_equipamentos_auvo
  for update to authenticated using (false);
create policy "os_equipamentos_auvo_deny_delete" on pcm.os_equipamentos_auvo
  for delete to authenticated using (false);
