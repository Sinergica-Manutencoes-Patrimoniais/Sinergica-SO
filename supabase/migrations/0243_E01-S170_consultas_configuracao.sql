-- E01-S170: consultas administrativas paginadas e verificadas na sessão atual.
-- Reverso: retirar as RPCs após desabilitar os consumidores; os dados não são alterados.
create or replace function config.sso_verificar_consulta_admin(p_inicio integer, p_limite integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from config.usuarios u where u.user_id = auth.uid()
    and u.ativo and u.papel = 'superadmin' and auth.jwt() ->> 'user_role' = 'superadmin') then
    raise exception 'sem_permissao_para_configurar' using errcode = '42501';
  end if;
  if p_inicio is null or p_inicio < 0 or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'paginacao_invalida' using errcode = '22023';
  end if;
end;
$$;
revoke all on function config.sso_verificar_consulta_admin(integer, integer) from public, anon, authenticated, service_role;

create or replace function config.sso_listar_perfis(p_inicio integer, p_limite integer)
returns table(id uuid, nome text, ativo boolean, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform config.sso_verificar_consulta_admin(p_inicio, p_limite);
  return query select p.id, p.nome, p.ativo, p.revisao from config.sso_perfis p
    order by p.nome, p.id offset p_inicio limit p_limite;
end;
$$;
create or replace function config.sso_listar_vinculos(p_inicio integer, p_limite integer)
returns table(id uuid, usuario_id uuid, perfil_id uuid, ativo boolean, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform config.sso_verificar_consulta_admin(p_inicio, p_limite);
  return query select v.id, v.usuario_id, v.perfil_id, v.ativo, v.revisao from config.sso_usuario_perfis v
    order by v.usuario_id, v.perfil_id offset p_inicio limit p_limite;
end;
$$;
create or replace function config.sso_listar_concessoes(p_inicio integer, p_limite integer)
returns table(id uuid, usuario_id uuid, perfil_id uuid, acao text, cliente_id uuid, ativa boolean, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform config.sso_verificar_consulta_admin(p_inicio, p_limite);
  return query select g.id, g.usuario_id, g.perfil_id, g.acao, g.cliente_id, g.ativa, g.revisao
    from config.sso_concessoes g order by g.id offset p_inicio limit p_limite;
end;
$$;
revoke all on function config.sso_listar_perfis(integer, integer) from public, anon;
revoke all on function config.sso_listar_vinculos(integer, integer) from public, anon;
revoke all on function config.sso_listar_concessoes(integer, integer) from public, anon;
grant execute on function config.sso_listar_perfis(integer, integer) to authenticated;
grant execute on function config.sso_listar_vinculos(integer, integer) to authenticated;
grant execute on function config.sso_listar_concessoes(integer, integer) to authenticated;
