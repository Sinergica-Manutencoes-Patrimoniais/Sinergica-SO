-- ADR-0038: opções por Cliente com paginação determinística.
create function pcm.sso_listar_destinos_estrutura(p_cliente_id uuid, p_tipo text, p_limite integer,
  p_apos uuid, p_busca text) returns table(id uuid, nome text, area_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_busca, '')));
begin
  if p_cliente_id is null or p_tipo not in ('area', 'local', 'componente') or p_limite is null
    or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) then
    raise exception 'destinos_nao_encontrados_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_tipo = 'area' then
    return query select a.id, a.nome, null::uuid from pcm.areas a
      where a.cliente_id = p_cliente_id and a.ativo and a.deleted_at is null
        and (p_apos is null or a.id > p_apos) and position(v_busca in pg_catalog.lower(a.nome)) > 0
      order by a.id limit p_limite;
  elsif p_tipo = 'local' then
    return query select l.id, l.nome, l.area_id from pcm.locais l join pcm.areas a on a.id = l.area_id
      where a.cliente_id = p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null
        and (p_apos is null or l.id > p_apos) and position(v_busca in pg_catalog.lower(l.nome)) > 0
      order by l.id limit p_limite;
  else
    return query select e.id, e.nome, e.area_id from pcm.equipamentos e
      where e.client_id = p_cliente_id and e.ativo and e.deleted_at is null
        and (p_apos is null or e.id > p_apos) and position(v_busca in pg_catalog.lower(e.nome)) > 0
      order by e.id limit p_limite;
  end if;
end;
$$;
revoke all on function pcm.sso_listar_destinos_estrutura(uuid, text, integer, uuid, text) from public, anon;
grant execute on function pcm.sso_listar_destinos_estrutura(uuid, text, integer, uuid, text) to authenticated;
