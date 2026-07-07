-- 0031_E01-S28_funcionarios.sql — Sinérgica SO
-- Promove o cache read-only de técnicos (E01-S11) para `pcm.funcionarios`, editável pelo PCM e
-- sincronizado com Auvo `/users`.
--
-- Reverso:
--   drop trigger if exists trg_funcionarios_auvo_enqueue on pcm.funcionarios;
--   drop function if exists pcm.fn_insert_funcionario_auvo_sync(bigint, text, text, text, text, text, int, uuid);
--   drop table if exists pcm.funcionarios;

create table if not exists pcm.funcionarios (
  id                    uuid        primary key default gen_random_uuid(),
  auvo_user_id          bigint      unique,
  auvo_id               bigint      unique,
  nome                  text        not null,
  equipe                text,
  cargo                 text,
  telefone              text,
  email                 text,
  culture               text        not null default 'pt-BR',
  user_type             int         not null default 1 check (user_type in (1, 2, 3)),
  ativo                 boolean     not null default true,
  auvo_sync_status      text        not null default 'pending',
  auvo_sync_error       text,
  auvo_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

insert into pcm.funcionarios (
  id, auvo_user_id, auvo_id, nome, equipe, ativo, auvo_sync_status, auvo_synced_at, created_at, updated_at
)
select
  id, auvo_user_id, auvo_user_id, nome, equipe, ativo, 'synced', updated_at, created_at, updated_at
from pcm.tecnicos_cache
on conflict (auvo_user_id) do update
set
  auvo_id = excluded.auvo_id,
  nome = excluded.nome,
  equipe = excluded.equipe,
  ativo = excluded.ativo,
  updated_at = excluded.updated_at;

create index if not exists idx_funcionarios_deleted_nome
  on pcm.funcionarios (deleted_at, nome);
create index if not exists idx_funcionarios_ativo
  on pcm.funcionarios (ativo);

alter table pcm.funcionarios enable row level security;
alter table pcm.funcionarios force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.funcionarios to authenticated;
grant select, insert, update, delete on pcm.funcionarios to service_role;

create policy "funcionarios_select" on pcm.funcionarios
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- E01-S28 inverte deliberadamente o contrato read-only de `pcm.tecnicos_cache` (0012):
-- funcionários agora são cadastro operacional do PCM. Escrita segue restrita a `pcm:escrita`.
create policy "funcionarios_insert" on pcm.funcionarios
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "funcionarios_update" on pcm.funcionarios
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create or replace function pcm.fn_insert_funcionario_auvo_sync(
  p_auvo_id bigint,
  p_nome text,
  p_equipe text,
  p_cargo text,
  p_telefone text,
  p_email text,
  p_culture text,
  p_user_type int,
  p_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_id uuid;
begin
  perform set_config('app.auvo_sync_write', 'true', true);

  insert into pcm.funcionarios (
    auvo_user_id, auvo_id, nome, equipe, cargo, telefone, email, culture, user_type, ativo,
    auvo_sync_status, auvo_synced_at, created_by, updated_by
  ) values (
    p_auvo_id, p_auvo_id, p_nome, p_equipe, p_cargo, p_telefone, p_email, p_culture, p_user_type,
    true, 'synced', now(), p_user_id, p_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function pcm.fn_insert_funcionario_auvo_sync(bigint, text, text, text, text, text, text, int, uuid) from public;
grant execute on function pcm.fn_insert_funcionario_auvo_sync(bigint, text, text, text, text, text, text, int, uuid) to service_role;

create trigger trg_funcionarios_auvo_enqueue
  after insert or update or delete on pcm.funcionarios
  for each row execute function pcm.fn_auvo_enqueue('funcionarios');
