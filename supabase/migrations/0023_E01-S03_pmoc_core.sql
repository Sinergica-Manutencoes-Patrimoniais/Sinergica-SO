-- 0023_E01-S03_pmoc_core.sql — Sinérgica SO
-- Story E01-S03. Fundação do sub-módulo PMOC dentro do PCM.
--
-- Rollback:
--   drop table if exists pcm.pmoc_nonconformity_log;
--   drop table if exists pcm.pmoc_microbio_analysis;
--   drop table if exists pcm.pmoc_records;
--   drop table if exists pcm.pmoc_schedules;
--   drop table if exists pcm.pmoc_contracts;
--   drop table if exists pcm.pmoc_equipment;
--   drop table if exists pcm.pmoc_properties;

create table if not exists pcm.pmoc_properties (
  id             uuid        primary key default gen_random_uuid(),
  client_id      uuid        references pcm.clientes,
  name           text        not null,
  type           text        not null default 'residencial'
                             check (type in ('residencial', 'comercial', 'industrial', 'saude', 'outro')),
  address        text,
  city           text        default 'Campinas',
  state          text        default 'SP',
  zipcode        text,
  cnpj_cpf       text,
  contact_name   text,
  contact_role   text,
  contact_phone  text,
  contact_email  text,
  created_at     timestamptz not null default now(),
  created_by     uuid        not null references auth.users,
  updated_at     timestamptz,
  updated_by     uuid        references auth.users,
  deleted_at     timestamptz
);

create table if not exists pcm.pmoc_equipment (
  id             uuid        primary key default gen_random_uuid(),
  property_id    uuid        not null references pcm.pmoc_properties on delete cascade,
  auvo_equipment_id bigint,
  tag            text        not null,
  type           text        not null default 'split-hiwall'
                             check (type in (
                               'split-hiwall', 'cassete', 'piso-teto', 'duto', 'vrf-vrv',
                               'fancoil', 'central-agua-gelada', 'self-contained',
                               'janeleiro', 'portatil', 'outro'
                             )),
  brand          text,
  model          text,
  serial_evap    text,
  serial_cond    text,
  capacity_btu   integer,
  location       text,
  environment    text,
  floor          text,
  refrigerant    text        not null default 'R-410A'
                             check (refrigerant in ('R-22', 'R-410A', 'R-32', 'R-404A', 'R-407C', 'outro')),
  power_kw       numeric,
  phase          text        check (phase in ('mono', 'bi', 'tri')),
  install_date   date,
  condition      text        not null default 'bom'
                             check (condition in ('bom', 'regular', 'ruim', 'critico')),
  photo_url      text,
  active         boolean     not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid        not null references auth.users,
  updated_at     timestamptz,
  updated_by     uuid        references auth.users,
  deleted_at     timestamptz,
  unique (property_id, tag)
);

create table if not exists pcm.pmoc_contracts (
  id               uuid        primary key default gen_random_uuid(),
  property_id      uuid        not null references pcm.pmoc_properties on delete cascade,
  technician_name  text        not null default 'Fabrício Medeiros',
  crea             text,
  art_number       text,
  art_date         date,
  start_date       date        not null,
  end_date         date        not null,
  status           text        not null default 'ativo'
                                check (status in ('ativo', 'encerrado', 'renovar')),
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid        not null references auth.users,
  updated_at       timestamptz,
  updated_by       uuid        references auth.users,
  deleted_at       timestamptz,
  check (end_date >= start_date)
);

create table if not exists pcm.pmoc_schedules (
  id               uuid        primary key default gen_random_uuid(),
  contract_id      uuid        not null references pcm.pmoc_contracts on delete cascade,
  property_id      uuid        not null references pcm.pmoc_properties on delete cascade,
  scheduled_date   date        not null,
  maintenance_type text        not null check (maintenance_type in ('mensal', 'trimestral', 'semestral', 'anual')),
  month_ref        integer     not null check (month_ref between 1 and 12),
  year_ref         integer     not null,
  status           text        not null default 'agendado'
                                check (status in ('agendado', 'realizado', 'atrasado', 'cancelado')),
  record_id        uuid,
  auvo_os_id       text,
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users
);

create table if not exists pcm.pmoc_records (
  id                 uuid        primary key default gen_random_uuid(),
  schedule_id        uuid        references pcm.pmoc_schedules,
  contract_id        uuid        not null references pcm.pmoc_contracts on delete cascade,
  property_id        uuid        not null references pcm.pmoc_properties on delete cascade,
  executed_date      date        not null,
  time_start         time,
  time_end           time,
  maintenance_type   text        check (maintenance_type in ('mensal', 'trimestral', 'semestral', 'anual', 'corretiva')),
  technician_name    text,
  auvo_os_number     text,
  equipment_records  jsonb       not null default '[]'::jsonb,
  checklist          jsonb       not null default '{}'::jsonb,
  materials_used     jsonb       not null default '[]'::jsonb,
  nonconformities    jsonb       not null default '[]'::jsonb,
  observations       text,
  pending_items      text,
  next_visit_date    date,
  technician_signed  boolean     not null default false,
  client_signed      boolean     not null default false,
  pdf_url            text,
  created_at         timestamptz not null default now(),
  created_by         uuid        not null references auth.users,
  updated_at         timestamptz,
  updated_by         uuid        references auth.users
);

alter table pcm.pmoc_schedules
  drop constraint if exists fk_pmoc_schedules_record;
alter table pcm.pmoc_schedules
  add constraint fk_pmoc_schedules_record foreign key (record_id) references pcm.pmoc_records;

create table if not exists pcm.pmoc_microbio_analysis (
  id                         uuid        primary key default gen_random_uuid(),
  contract_id                uuid        not null references pcm.pmoc_contracts on delete cascade,
  property_id                uuid        not null references pcm.pmoc_properties on delete cascade,
  analysis_date              date        not null,
  lab_name                   text,
  lab_accreditation          text,
  collection_points          integer,
  fungi_ufc_m3               numeric,
  ie_ratio                   numeric,
  coliforms_result           text        check (coliforms_result in ('ausencia', 'presenca')),
  status                     text        not null default 'pendente'
                                         check (status in ('conforme', 'nao_conforme', 'pendente')),
  report_number              text,
  report_url                 text,
  corrective_action_needed   boolean     not null default false,
  notes                      text,
  created_at                 timestamptz not null default now(),
  created_by                 uuid        not null references auth.users
);

create table if not exists pcm.pmoc_nonconformity_log (
  id                  uuid        primary key default gen_random_uuid(),
  record_id           uuid        references pcm.pmoc_records on delete set null,
  contract_id         uuid        references pcm.pmoc_contracts on delete cascade,
  equipment_id        uuid        references pcm.pmoc_equipment on delete set null,
  tag                 text,
  description         text        not null,
  severity            text        not null default 'media' check (severity in ('alta', 'media', 'baixa')),
  recommended_action  text,
  responsible         text,
  deadline            date,
  completed_at        date,
  status              text        not null default 'aberto'
                                      check (status in ('aberto', 'em_andamento', 'fechado')),
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users
);

create index if not exists idx_pmoc_properties_client
  on pcm.pmoc_properties (client_id)
  where deleted_at is null;
create index if not exists idx_pmoc_equipment_property
  on pcm.pmoc_equipment (property_id, active)
  where deleted_at is null;
create index if not exists idx_pmoc_equipment_auvo
  on pcm.pmoc_equipment (auvo_equipment_id)
  where auvo_equipment_id is not null and deleted_at is null;
create unique index if not exists uq_pmoc_equipment_property_auvo
  on pcm.pmoc_equipment (property_id, auvo_equipment_id)
  where auvo_equipment_id is not null and deleted_at is null;
create index if not exists idx_pmoc_contracts_property_status
  on pcm.pmoc_contracts (property_id, status, end_date)
  where deleted_at is null;
create index if not exists idx_pmoc_schedules_contract_date
  on pcm.pmoc_schedules (contract_id, scheduled_date);
create index if not exists idx_pmoc_schedules_status_date
  on pcm.pmoc_schedules (status, scheduled_date);
create index if not exists idx_pmoc_microbio_contract_date
  on pcm.pmoc_microbio_analysis (contract_id, analysis_date desc);
create index if not exists idx_pmoc_nc_contract_status
  on pcm.pmoc_nonconformity_log (contract_id, status, severity);

alter table pcm.pmoc_properties          enable row level security;
alter table pcm.pmoc_properties          force row level security;
alter table pcm.pmoc_equipment           enable row level security;
alter table pcm.pmoc_equipment           force row level security;
alter table pcm.pmoc_contracts           enable row level security;
alter table pcm.pmoc_contracts           force row level security;
alter table pcm.pmoc_schedules           enable row level security;
alter table pcm.pmoc_schedules           force row level security;
alter table pcm.pmoc_records             enable row level security;
alter table pcm.pmoc_records             force row level security;
alter table pcm.pmoc_microbio_analysis   enable row level security;
alter table pcm.pmoc_microbio_analysis   force row level security;
alter table pcm.pmoc_nonconformity_log   enable row level security;
alter table pcm.pmoc_nonconformity_log   force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on
  pcm.pmoc_properties,
  pcm.pmoc_equipment,
  pcm.pmoc_contracts,
  pcm.pmoc_schedules,
  pcm.pmoc_records,
  pcm.pmoc_microbio_analysis,
  pcm.pmoc_nonconformity_log
to authenticated;
grant select, insert, update, delete on
  pcm.pmoc_properties,
  pcm.pmoc_equipment,
  pcm.pmoc_contracts,
  pcm.pmoc_schedules,
  pcm.pmoc_records,
  pcm.pmoc_microbio_analysis,
  pcm.pmoc_nonconformity_log
to service_role;

create policy "pmoc_properties_select" on pcm.pmoc_properties
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_properties_insert" on pcm.pmoc_properties
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_properties_update" on pcm.pmoc_properties
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_equipment_select" on pcm.pmoc_equipment
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_equipment_insert" on pcm.pmoc_equipment
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_equipment_update" on pcm.pmoc_equipment
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_contracts_select" on pcm.pmoc_contracts
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_contracts_insert" on pcm.pmoc_contracts
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_contracts_update" on pcm.pmoc_contracts
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_schedules_select" on pcm.pmoc_schedules
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_schedules_insert" on pcm.pmoc_schedules
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_schedules_update" on pcm.pmoc_schedules
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_records_select" on pcm.pmoc_records
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_records_insert" on pcm.pmoc_records
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_records_update" on pcm.pmoc_records
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_microbio_select" on pcm.pmoc_microbio_analysis
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_microbio_insert" on pcm.pmoc_microbio_analysis
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_microbio_update" on pcm.pmoc_microbio_analysis
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "pmoc_nc_select" on pcm.pmoc_nonconformity_log
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "pmoc_nc_insert" on pcm.pmoc_nonconformity_log
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "pmoc_nc_update" on pcm.pmoc_nonconformity_log
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
