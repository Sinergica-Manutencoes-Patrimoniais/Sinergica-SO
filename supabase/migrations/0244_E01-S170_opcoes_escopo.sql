-- E01-S170: opções mínimas para atribuição, acessíveis apenas ao administrador ativo.
-- Reverso: retirar RPCs após desabilitar consumidores, sem alterar usuários ou Clientes.
create or replace function config.sso_listar_usuarios(p_inicio integer, p_limite integer)
returns table(user_id uuid, nome text, papel text, ativo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform config.sso_verificar_consulta_admin(p_inicio, p_limite);
  return query select u.user_id, u.nome, u.papel, u.ativo from config.usuarios u
    order by u.nome, u.user_id offset p_inicio limit p_limite;
end;
$$;
create or replace function config.sso_listar_clientes(p_inicio integer, p_limite integer)
returns table(id uuid, nome text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform config.sso_verificar_consulta_admin(p_inicio, p_limite);
  return query select c.id, c.nome from pcm.clientes c where c.ativo and c.deleted_at is null
    order by c.nome, c.id offset p_inicio limit p_limite;
end;
$$;
revoke all on function config.sso_listar_usuarios(integer, integer) from public, anon;
revoke all on function config.sso_listar_clientes(integer, integer) from public, anon;
grant execute on function config.sso_listar_usuarios(integer, integer) to authenticated;
grant execute on function config.sso_listar_clientes(integer, integer) to authenticated;
