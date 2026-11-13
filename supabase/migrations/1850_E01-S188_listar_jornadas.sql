-- E01-S188 — lista as jornadas declaradas, para a tela de consulta não precisar hardcodar
-- códigos. Mesma restrição de acesso do diagnóstico: só superadmin.
--
-- Reverso:
--   drop function if exists config.sso_listar_jornadas();

create function config.sso_listar_jornadas() returns table (
  codigo text, titulo text, descricao text, ativavel boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from config.usuarios where user_id = auth.uid() and ativo and papel = 'superadmin'
  ) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return query select j.codigo, j.titulo, j.descricao, j.ativavel
    from config.sso_jornadas j order by j.titulo;
end;
$$;
revoke all on function config.sso_listar_jornadas() from public, anon, service_role;
grant execute on function config.sso_listar_jornadas() to authenticated;
