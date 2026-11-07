-- ADR-0195: consulta privada e revogada.
create function pcm.sso_listar_clientes_triagem(p_apos uuid,p_limite integer)
returns table(id uuid,nome text) language plpgsql stable security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.nome from pcm.clientes c where c.ativo and c.deleted_at is null and (p_apos is null or c.id>p_apos)
    and config.sso_autorizar_acao('integracao.reconciliar',c.id) is true order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_clientes_triagem(uuid,integer) from public,anon,authenticated,service_role;
