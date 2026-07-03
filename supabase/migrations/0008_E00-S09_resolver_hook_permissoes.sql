-- 0008_E00-S09_resolver_hook_permissoes.sql — Sinérgica SO
-- Story E00-S09. Adiciona resolvedor de permissões por módulo, view de auto-consulta,
-- função atômica de troca de modo e claim JWT `user_modulos`.
--
-- Reverso:
--   drop view if exists config.minhas_permissoes;
--   drop function if exists config.definir_permissao_usuario(uuid, uuid, jsonb);
--   drop function if exists config.resolver_permissoes_modulo(uuid);
--   -- recriar `config.custom_access_token_hook` no formato anterior, emitindo só `user_role`.

-- ─────────────────────────── RESOLVEDOR ────────────────────────────────────

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
  if p_user_id is null then
    return;
  end if;

  -- BUG DE SEGURANÇA CORRIGIDO (achado em revisão, nunca chegou a rodar via `supabase test db`):
  -- `current_user`, dentro de uma função SECURITY DEFINER, é sempre o DONO da função (ex.:
  -- `postgres`), não quem chamou — então `current_user not in ('postgres', ...)` era sempre
  -- falso, e a guarda inteira nunca disparava. `session_user` não muda com SECURITY DEFINER,
  -- é sempre quem efetivamente conectou/chamou — é o certo para essa checagem.
  if session_user not in ('postgres', 'service_role', 'supabase_auth_admin')
     and not (
       auth.uid() = p_user_id
       or auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor')
     ) then
    raise exception 'sem_permissao_para_resolver_permissoes'
      using errcode = '42501';
  end if;

  select u.papel, u.ativo, u.grupo_id
    into v_papel, v_ativo, v_grupo_id
    from config.usuarios u
   where u.user_id = p_user_id;

  if not found or v_ativo is not true then
    return;
  end if;

  if v_papel = 'superadmin' or v_papel = 'cliente-sindico' then
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

grant execute on function config.resolver_permissoes_modulo(uuid) to authenticated, supabase_auth_admin;
revoke execute on function config.resolver_permissoes_modulo(uuid) from public, anon;

grant execute on function config.provisionar_usuario(uuid, text, text) to service_role;

create or replace view config.minhas_permissoes
with (security_invoker = true)
as
select modulo, nivel
  from config.resolver_permissoes_modulo(auth.uid());

grant select on config.minhas_permissoes to authenticated;

-- ─────────────────────────── TROCA ATÔMICA DE MODO ─────────────────────────

create or replace function config.definir_permissao_usuario(
  p_user_id uuid,
  p_grupo_id uuid default null,
  p_permissoes jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  -- Mesma correção de session_user vs current_user do resolver acima — ver comentário lá.
  if session_user not in ('postgres', 'service_role')
     and auth.jwt() ->> 'user_role' not in ('superadmin', 'supervisor') then
    raise exception 'sem_permissao_para_definir_permissao_usuario'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'user_id_obrigatorio' using errcode = '23502';
  end if;

  if p_grupo_id is not null and p_permissoes is not null then
    raise exception 'grupo_e_permissoes_individuais_sao_mutuamente_exclusivos'
      using errcode = '23514';
  end if;

  perform 1 from config.usuarios where user_id = p_user_id;
  if not found then
    raise exception 'usuario_nao_encontrado' using errcode = '23503';
  end if;

  if p_grupo_id is not null then
    perform 1 from config.grupos where id = p_grupo_id;
    if not found then
      raise exception 'grupo_nao_encontrado' using errcode = '23503';
    end if;

    delete from config.usuario_modulos where user_id = p_user_id;
    update config.usuarios
       set grupo_id = p_grupo_id,
           updated_at = now(),
           updated_by = auth.uid()
     where user_id = p_user_id;
    return;
  end if;

  update config.usuarios
     set grupo_id = null,
         updated_at = now(),
         updated_by = auth.uid()
   where user_id = p_user_id;

  delete from config.usuario_modulos where user_id = p_user_id;

  if p_permissoes is null then
    return;
  end if;

  if jsonb_typeof(p_permissoes) <> 'object' then
    raise exception 'permissoes_devem_ser_objeto_json'
      using errcode = '22023';
  end if;

  for v_item in select key as modulo, value #>> '{}' as nivel from jsonb_each(p_permissoes)
  loop
    if v_item.nivel not in ('leitura', 'escrita') then
      raise exception 'nivel_de_permissao_invalido: %', v_item.nivel
        using errcode = '23514';
    end if;

    insert into config.usuario_modulos (user_id, modulo, nivel, created_by)
    values (p_user_id, v_item.modulo, v_item.nivel, auth.uid());
  end loop;
end;
$$;

grant execute on function config.definir_permissao_usuario(uuid, uuid, jsonb) to authenticated, service_role;
revoke execute on function config.definir_permissao_usuario(uuid, uuid, jsonb) from public, anon;

-- ─────────────────────────── CUSTOM ACCESS TOKEN HOOK ──────────────────────

create or replace function config.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_papel text;
  v_claims jsonb;
  v_modulos jsonb;
begin
  select papel into v_papel
    from config.usuarios
   where user_id = (event ->> 'user_id')::uuid
     and ativo = true;

  select coalesce(jsonb_object_agg(p.modulo, p.nivel), '{}'::jsonb)
    into v_modulos
    from config.resolver_permissoes_modulo((event ->> 'user_id')::uuid) p;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_papel));
  v_claims := jsonb_set(v_claims, '{user_modulos}', v_modulos);

  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$$;

grant execute on function config.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function config.custom_access_token_hook(jsonb) from public, anon, authenticated;
