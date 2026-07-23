-- 0095_E01-S76_hierarquia_localizacao_ativos.sql — Sinérgica SO
-- Introduz Cliente > Área > Local (árvore) > Item (Equipamento|Componente) + Sistemas transversais
-- (N:N) no PCM. ADR-0009: estende `pcm.equipamentos` in-place (NÃO cria `pcm.itens` — preserva
-- 2000+ linhas + pipeline de sync Auvo); Sistema vai ao Auvo como Equipment, push-only,
-- `writeEnabled:false` no descriptor (registry/sistemas.ts).
--
-- FKs novas em pcm.equipamentos entram NOT VALID (tabela com dados de produção) — VALIDATE na
-- migration seguinte (0096), mesmo padrão de 0070/0071.
--
-- Reverso:
--   drop table if exists pcm.sistema_itens;
--   drop trigger if exists trg_sistemas_auvo_enqueue on pcm.sistemas;
--   drop table if exists pcm.sistemas;
--   drop trigger if exists trg_locais_valida_hierarquia on pcm.locais;
--   drop function if exists pcm.fn_locais_valida_hierarquia();
--   drop table if exists pcm.locais;
--   drop table if exists pcm.areas;
--   alter table pcm.equipamentos
--     drop constraint if exists fk_equipamentos_parent,
--     drop constraint if exists fk_equipamentos_local,
--     drop constraint if exists chk_equipamentos_tipo,
--     drop column if exists parent_item_id,
--     drop column if exists tipo,
--     drop column if exists local_id;

-- ── pcm.areas ────────────────────────────────────────────────────────────────
create table if not exists pcm.areas (
  id          uuid        primary key default gen_random_uuid(),
  cliente_id  uuid        not null references pcm.clientes (id),
  nome        text        not null,
  descricao   text,
  ordem       int         not null default 0,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users,
  deleted_at  timestamptz
);
create unique index if not exists uq_areas_cliente_nome
  on pcm.areas (cliente_id, lower(nome)) where deleted_at is null;
create index if not exists idx_areas_cliente
  on pcm.areas (cliente_id) where deleted_at is null;

alter table pcm.areas enable row level security;
alter table pcm.areas force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.areas to authenticated;
grant select, insert, update, delete on pcm.areas to service_role;

create policy "areas_select" on pcm.areas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "areas_insert" on pcm.areas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "areas_update" on pcm.areas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- ── pcm.locais (árvore) ────────────────────────────────────────────────────
create table if not exists pcm.locais (
  id          uuid        primary key default gen_random_uuid(),
  area_id     uuid        not null references pcm.areas (id),
  parent_id   uuid        references pcm.locais (id),
  nome        text        not null,
  tipo        text,                       -- livre/nullable: 'andar'|'sala'|'ambiente'|...
  descricao   text,
  ordem       int         not null default 0,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users,
  deleted_at  timestamptz
);
create index if not exists idx_locais_area
  on pcm.locais (area_id) where deleted_at is null;
create index if not exists idx_locais_parent
  on pcm.locais (parent_id) where deleted_at is null;

-- Trigger: valida consistência de área + ausência de ciclo (INV 1 e 2 do domain.md).
create or replace function pcm.fn_locais_valida_hierarquia()
returns trigger
language plpgsql
as $$
declare
  v_area   uuid;
  v_cursor uuid;
  v_guard  int := 0;
begin
  if new.parent_id is not null then
    select area_id into v_area from pcm.locais where id = new.parent_id;
    if v_area is null or v_area <> new.area_id then
      raise exception 'Local pai deve pertencer à mesma Área';
    end if;
    v_cursor := new.parent_id;
    while v_cursor is not null loop
      if v_cursor = new.id then
        raise exception 'Ciclo de Local detectado';
      end if;
      v_guard := v_guard + 1;
      if v_guard > 100 then
        raise exception 'Profundidade excessiva de Local';
      end if;
      select parent_id into v_cursor from pcm.locais where id = v_cursor;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_locais_valida_hierarquia on pcm.locais;
create trigger trg_locais_valida_hierarquia
  before insert or update on pcm.locais
  for each row execute function pcm.fn_locais_valida_hierarquia();

alter table pcm.locais enable row level security;
alter table pcm.locais force row level security;

grant select, insert, update on pcm.locais to authenticated;
grant select, insert, update, delete on pcm.locais to service_role;

create policy "locais_select" on pcm.locais
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "locais_insert" on pcm.locais
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "locais_update" on pcm.locais
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- ── pcm.sistemas (colunas de sync Auvo — espelha pcm.equipamentos) ────────────
create table if not exists pcm.sistemas (
  id                 uuid        primary key default gen_random_uuid(),
  cliente_id         uuid        not null references pcm.clientes (id),
  area_id            uuid        references pcm.areas (id),   -- escopo opcional a uma Área
  nome               text        not null,
  tipo               text,                                     -- classificação opcional (hidrante/incêndio/spda/...)
  descricao          text,
  ativo              boolean     not null default true,
  auvo_id            bigint      unique,
  auvo_equipment_id  bigint      unique,
  codigo             text,                                     -- identifier recebido do Auvo
  auvo_sync_status   text        not null default 'pending',
  auvo_sync_error    text,
  auvo_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid        references auth.users,
  updated_at         timestamptz not null default now(),
  updated_by         uuid        references auth.users,
  deleted_at         timestamptz
);
create index if not exists idx_sistemas_cliente
  on pcm.sistemas (cliente_id) where deleted_at is null;

alter table pcm.sistemas enable row level security;
alter table pcm.sistemas force row level security;

grant select, insert, update on pcm.sistemas to authenticated;
grant select, insert, update, delete on pcm.sistemas to service_role;

create policy "sistemas_select" on pcm.sistemas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "sistemas_insert" on pcm.sistemas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "sistemas_update" on pcm.sistemas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create trigger trg_sistemas_auvo_enqueue
  after insert or update or delete on pcm.sistemas
  for each row execute function pcm.fn_auvo_enqueue('sistemas');

-- ── pcm.sistema_itens (N:N Sistema↔Item) ──────────────────────────────────────
create table if not exists pcm.sistema_itens (
  id          uuid        primary key default gen_random_uuid(),
  sistema_id  uuid        not null references pcm.sistemas (id),
  item_id     uuid        not null references pcm.equipamentos (id),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users
);
create unique index if not exists uq_sistema_item
  on pcm.sistema_itens (sistema_id, item_id);
create index if not exists idx_sistema_itens_item
  on pcm.sistema_itens (item_id);

alter table pcm.sistema_itens enable row level security;
alter table pcm.sistema_itens force row level security;

grant select, insert, update on pcm.sistema_itens to authenticated;
grant select, insert, update, delete on pcm.sistema_itens to service_role;

create policy "sistema_itens_select" on pcm.sistema_itens
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "sistema_itens_insert" on pcm.sistema_itens
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "sistema_itens_delete" on pcm.sistema_itens
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- ── Extensão de pcm.equipamentos (aditivo, seguro em produção — ADR-0009) ────
alter table pcm.equipamentos add column if not exists local_id uuid;
alter table pcm.equipamentos add column if not exists tipo text not null default 'equipamento';
alter table pcm.equipamentos add column if not exists parent_item_id uuid;

alter table pcm.equipamentos
  add constraint chk_equipamentos_tipo check (tipo in ('equipamento', 'componente')) not valid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_local foreign key (local_id) references pcm.locais (id) not valid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_parent foreign key (parent_item_id) references pcm.equipamentos (id) not valid;

create index if not exists idx_equipamentos_local
  on pcm.equipamentos (local_id) where deleted_at is null;
create index if not exists idx_equipamentos_parent_item
  on pcm.equipamentos (parent_item_id) where deleted_at is null;

comment on column pcm.equipamentos.tipo is 'ADR-0009: "equipamento" ou "componente" — conceito vira "Item" na UI/domínio; nome físico da tabela preservado (pipeline Auvo existente).';
comment on column pcm.equipamentos.local_id is 'ADR-0009: vínculo opcional a pcm.locais — resolve o breadcrumb Cliente>Área>Local do Item.';
comment on column pcm.equipamentos.parent_item_id is 'ADR-0009: Componente pode ser filho de um Equipamento (mesmo client_id) — guard em application, não em FK.';
