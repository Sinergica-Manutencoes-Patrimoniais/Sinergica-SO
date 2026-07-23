-- 0100_E01-S04_pcm_equipment_mirror.sql — Sinérgica SO
-- Inventário geral cross-disciplina do imóvel (design.md de E01-S03, Decisão 2). Ao cadastrar um
-- equipamento de AR no PMOC, um trigger espelha automaticamente em pcm.pcm_equipment — o técnico
-- nunca vê "PMOC" e "PCM" como sistemas separados. Só climatização tem fonte hoje (pmoc_equipment);
-- outras disciplinas (elétrica/hidráulica/SPCI/civil/SPDA) entram quando ganharem cadastro próprio.
-- Tabela nova, sem escrita de aplicação — só o trigger grava aqui.
--
-- Reverso:
--   drop trigger if exists trg_pmoc_equipment_espelha_pcm on pcm.pmoc_equipment;
--   drop function if exists pcm.fn_pmoc_equipment_espelha_pcm();
--   drop table if exists pcm.pcm_equipment;

create table if not exists pcm.pcm_equipment (
  id                uuid        primary key default gen_random_uuid(),
  property_id       uuid        not null references pcm.pmoc_properties on delete cascade,
  pmoc_equipment_id uuid        references pcm.pmoc_equipment on delete cascade,
  discipline        text        not null default 'outro'
                                check (discipline in (
                                  'eletrica', 'hidraulica', 'climatizacao', 'spci', 'civil', 'spda', 'outro'
                                )),
  type              text,
  tag               text        not null,
  name              text,
  brand             text,
  model             text,
  serial            text,
  location          text,
  install_date      date,
  last_maintenance  date,
  next_maintenance  date,
  condition         text        not null default 'bom'
                                check (condition in ('bom', 'regular', 'ruim', 'critico')),
  photo_url         text,
  active            boolean     not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users,
  updated_at        timestamptz,
  updated_by        uuid        references auth.users,
  deleted_at        timestamptz,
  unique (pmoc_equipment_id)
);

create index if not exists idx_pcm_equipment_property
  on pcm.pcm_equipment (property_id) where deleted_at is null;
create index if not exists idx_pcm_equipment_discipline
  on pcm.pcm_equipment (discipline) where deleted_at is null;

alter table pcm.pcm_equipment enable row level security;
alter table pcm.pcm_equipment force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select on pcm.pcm_equipment to authenticated;
grant select, insert, update, delete on pcm.pcm_equipment to service_role;

create policy "pcm_equipment_select" on pcm.pcm_equipment
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- AC-4: nenhuma policy de insert/update/delete pra `authenticated` — a aplicação nunca escreve aqui
-- diretamente. Só o trigger abaixo (executado com os privilégios do usuário `pcm:escrita` que já
-- passou na policy `pmoc_equipment_insert`) grava, e o `security definer` garante que o INSERT no
-- espelho não dependa de uma policy de escrita pública nesta tabela.

create or replace function pcm.fn_pmoc_equipment_espelha_pcm()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
begin
  insert into pcm.pcm_equipment (
    property_id, pmoc_equipment_id, discipline, type, tag, name, brand, model, serial,
    location, install_date, condition, photo_url, active, notes, created_by
  )
  values (
    new.property_id, new.id, 'climatizacao', new.type, new.tag,
    coalesce(nullif(trim(concat_ws(' ', new.brand, new.model)), ''), new.tag),
    new.brand, new.model,
    nullif(concat_ws(' / ', nullif(new.serial_evap, ''), nullif(new.serial_cond, '')), ''),
    new.location, new.install_date, new.condition, new.photo_url, new.active, new.notes,
    new.created_by
  )
  on conflict (pmoc_equipment_id) do update set
    discipline   = 'climatizacao',
    type         = excluded.type,
    tag          = excluded.tag,
    name         = excluded.name,
    brand        = excluded.brand,
    model        = excluded.model,
    serial       = excluded.serial,
    location     = excluded.location,
    install_date = excluded.install_date,
    condition    = excluded.condition,
    photo_url    = excluded.photo_url,
    active       = excluded.active,
    notes        = excluded.notes,
    deleted_at   = new.deleted_at,
    updated_at   = now(),
    updated_by   = new.updated_by;
  return new;
end;
$$;

create trigger trg_pmoc_equipment_espelha_pcm
  after insert or update on pcm.pmoc_equipment
  for each row execute function pcm.fn_pmoc_equipment_espelha_pcm();
