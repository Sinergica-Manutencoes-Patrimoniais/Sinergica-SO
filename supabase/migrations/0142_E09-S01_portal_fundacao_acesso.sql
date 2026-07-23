-- 0142_E09-S01_portal_fundacao_acesso.sql — Sinérgica SO
-- Fundação segurança-crítica do Portal do Cliente: vínculo 1:1, claim cliente_id,
-- permissão area-cliente e isolamento por linha. ADR-0011.

create table config.usuario_cliente (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cliente_id uuid not null unique references pcm.clientes (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

alter table config.usuario_cliente enable row level security;
alter table config.usuario_cliente force row level security;

grant select on config.usuario_cliente to authenticated, supabase_auth_admin;
grant select, insert, update, delete on config.usuario_cliente to service_role;

create policy "usuario_cliente_select_proprio" on config.usuario_cliente
  for select to authenticated
  using (user_id = auth.uid());

create policy "config.usuario_cliente: auth admin le hook" on config.usuario_cliente
  for select to supabase_auth_admin
  using (true);

create or replace function config.resolver_permissoes_modulo(p_user_id uuid)
returns table (modulo text, nivel text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_papel text;
  v_ativo boolean;
  v_grupo_id uuid;
begin
  if p_user_id is null then return; end if;

  if coalesce(auth.jwt() ->> 'role', 'service_role') <> 'service_role'
     and not (
       auth.uid() = p_user_id
       or coalesce(auth.jwt() ->> 'user_role', '') in ('superadmin', 'supervisor')
     ) then
    raise exception 'sem_permissao_para_resolver_permissoes' using errcode = '42501';
  end if;

  select u.papel, u.ativo, u.grupo_id
    into v_papel, v_ativo, v_grupo_id
    from config.usuarios u
   where u.user_id = p_user_id;

  if not found or v_ativo is not true then return; end if;
  if v_papel = 'superadmin' then return; end if;

  if v_papel = 'cliente-sindico' then
    modulo := 'area-cliente';
    nivel := 'leitura';
    return next;
    return;
  end if;

  if v_grupo_id is not null then
    return query
      select gm.modulo, gm.nivel
        from config.grupo_modulos gm
        join config.grupos g on g.id = gm.grupo_id and g.ativo = true
       where gm.grupo_id = v_grupo_id
       order by gm.modulo;
    return;
  end if;

  return query
    select um.modulo, um.nivel
      from config.usuario_modulos um
     where um.user_id = p_user_id
     order by um.modulo;
end;
$$;

grant execute on function config.resolver_permissoes_modulo(uuid)
  to authenticated, supabase_auth_admin;

create or replace function config.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_papel text;
  v_cliente_id uuid;
  v_claims jsonb;
  v_modulos jsonb;
begin
  select u.papel into v_papel
    from config.usuarios u
   where u.user_id = (event ->> 'user_id')::uuid
     and u.ativo = true;

  select coalesce(jsonb_object_agg(p.modulo, p.nivel), '{}'::jsonb)
    into v_modulos
    from config.resolver_permissoes_modulo((event ->> 'user_id')::uuid) p;

  if v_papel = 'cliente-sindico' then
    select uc.cliente_id into v_cliente_id
      from config.usuario_cliente uc
     where uc.user_id = (event ->> 'user_id')::uuid;
  end if;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', coalesce(to_jsonb(v_papel), 'null'::jsonb));
  v_claims := jsonb_set(v_claims, '{user_modulos}', coalesce(v_modulos, '{}'::jsonb));

  if v_cliente_id is not null then
    v_claims := jsonb_set(v_claims, '{cliente_id}', to_jsonb(v_cliente_id::text));
  else
    v_claims := v_claims - 'cliente_id';
  end if;

  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$$;

grant execute on function config.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function config.custom_access_token_hook(jsonb) from public, anon, authenticated;

drop policy if exists "clientes_select" on pcm.clientes;
create policy "clientes_select" on pcm.clientes for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    )
  );

drop policy if exists "ordens_servico_select" on pcm.ordens_servico;
create policy "ordens_servico_select" on pcm.ordens_servico for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    )
  );

drop policy if exists "os_status_eventos_select" on pcm.os_status_eventos;
create policy "os_status_eventos_select" on pcm.os_status_eventos for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and exists (
        select 1 from pcm.ordens_servico os
         where os.id = ordem_servico_id
           and os.client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
      )
    )
  );
