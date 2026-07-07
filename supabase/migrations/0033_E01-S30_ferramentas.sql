-- 0033_E01-S30_ferramentas.sql — Sinérgica SO
-- Ferramentas/Kits (Auvo Products) e alocação por técnico via employee-product-stock.
--
-- Reverso:
--   drop trigger if exists trg_ferramentas_auvo_enqueue on pcm.ferramentas;
--   drop function if exists pcm.fn_reconcile_ferramenta_alocacoes(uuid, jsonb);
--   drop table if exists pcm.ferramenta_alocacoes;
--   drop table if exists pcm.ferramentas;

create table if not exists pcm.ferramentas (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text        not null,
  descricao             text,
  categoria_id          uuid        references pcm.produto_categorias,
  auvo_category_id      bigint,
  quantidade_total      int         not null default 0 check (quantidade_total >= 0),
  quantidade_minima     int         not null default 0 check (quantidade_minima >= 0),
  valor_unitario        numeric(12,2),
  custo_unitario        numeric(12,2),
  ativo                 boolean     not null default true,
  auvo_id               bigint      unique,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create table if not exists pcm.ferramenta_alocacoes (
  id                    uuid        primary key default gen_random_uuid(),
  ferramenta_id          uuid        not null references pcm.ferramentas on delete cascade,
  auvo_user_id           bigint      not null,
  funcionario_id         uuid        references pcm.funcionarios,
  quantidade             int         not null check (quantidade >= 0),
  origem_sync            text        not null default 'pcm' check (origem_sync in ('pcm','auvo')),
  auvo_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  created_by             uuid        references auth.users,
  updated_at             timestamptz not null default now(),
  updated_by             uuid        references auth.users,
  unique (ferramenta_id, auvo_user_id)
);

create index if not exists idx_ferramentas_deleted_nome
  on pcm.ferramentas (deleted_at, nome);
create index if not exists idx_ferramentas_categoria
  on pcm.ferramentas (categoria_id)
  where deleted_at is null;
create index if not exists idx_ferramentas_ativo
  on pcm.ferramentas (ativo);
create index if not exists idx_ferramenta_alocacoes_user
  on pcm.ferramenta_alocacoes (auvo_user_id);
create index if not exists idx_ferramenta_alocacoes_funcionario
  on pcm.ferramenta_alocacoes (funcionario_id);

alter table pcm.ferramentas enable row level security;
alter table pcm.ferramentas force row level security;
alter table pcm.ferramenta_alocacoes enable row level security;
alter table pcm.ferramenta_alocacoes force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.ferramentas, pcm.ferramenta_alocacoes to authenticated;
grant select, insert, update, delete on pcm.ferramentas, pcm.ferramenta_alocacoes to service_role;

create policy "ferramentas_select" on pcm.ferramentas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "ferramentas_insert" on pcm.ferramentas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "ferramentas_update" on pcm.ferramentas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "ferramenta_alocacoes_select" on pcm.ferramenta_alocacoes
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "ferramenta_alocacoes_insert" on pcm.ferramenta_alocacoes
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "ferramenta_alocacoes_update" on pcm.ferramenta_alocacoes
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create or replace function pcm.fn_reconcile_ferramenta_alocacoes(
  p_ferramenta_id uuid,
  p_employees_stock jsonb
) returns int
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_count int := 0;
begin
  if p_employees_stock is null or jsonb_typeof(p_employees_stock) <> 'array' then
    return 0;
  end if;

  with incoming as (
    select
      (item ->> 'userId')::bigint as auvo_user_id,
      greatest(coalesce((item ->> 'amount')::int, 0), 0) as quantidade
    from jsonb_array_elements(p_employees_stock) item
    where item ? 'userId'
  ),
  upserted as (
    insert into pcm.ferramenta_alocacoes (
      ferramenta_id, auvo_user_id, funcionario_id, quantidade, origem_sync, auvo_synced_at, updated_at
    )
    select
      p_ferramenta_id,
      i.auvo_user_id,
      f.id,
      i.quantidade,
      'auvo',
      now(),
      now()
    from incoming i
    left join pcm.funcionarios f on f.auvo_user_id = i.auvo_user_id
    on conflict (ferramenta_id, auvo_user_id) do update
    set
      funcionario_id = excluded.funcionario_id,
      quantidade = excluded.quantidade,
      origem_sync = 'auvo',
      auvo_synced_at = excluded.auvo_synced_at,
      updated_at = excluded.updated_at
    returning 1
  )
  select count(*) into v_count from upserted;

  delete from pcm.ferramenta_alocacoes a
  where a.ferramenta_id = p_ferramenta_id
    and not exists (
      select 1
      from jsonb_array_elements(p_employees_stock) item
      where item ? 'userId' and (item ->> 'userId')::bigint = a.auvo_user_id
    );

  return v_count;
end;
$$;

revoke all on function pcm.fn_reconcile_ferramenta_alocacoes(uuid, jsonb) from public;
grant execute on function pcm.fn_reconcile_ferramenta_alocacoes(uuid, jsonb) to service_role;

create trigger trg_ferramentas_auvo_enqueue
  after insert or update or delete on pcm.ferramentas
  for each row execute function pcm.fn_auvo_enqueue('ferramentas');
