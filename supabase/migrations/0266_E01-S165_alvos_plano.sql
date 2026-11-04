-- ADR-0044: projeção mínima para selecionar alvo do Plano com autorização atual.
create function pcm.sso_listar_alvos_plano(p_plano_id uuid, p_tipo text, p_limite integer, p_apos uuid, p_busca text)
returns table(id uuid, nome text) language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_busca text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_busca, '')));
begin
  if p_plano_id is null or p_tipo is null or p_tipo not in ('sistema', 'componente', 'grupo')
    or p_limite is null or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id = p_plano_id;
  if v_cliente is null or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_tipo = 'sistema' then
    return query select s.id, s.nome from pcm.sistemas s where s.cliente_id = v_cliente and s.ativo and s.deleted_at is null
      and (p_apos is null or s.id > p_apos) and position(v_busca in pg_catalog.lower(s.nome)) > 0 order by s.id limit p_limite;
  elsif p_tipo = 'componente' then
    return query select e.id, e.nome from pcm.equipamentos e where e.client_id = v_cliente and e.ativo and e.deleted_at is null
      and (p_apos is null or e.id > p_apos) and position(v_busca in pg_catalog.lower(e.nome)) > 0 order by e.id limit p_limite;
  else
    return query select g.id, g.nome from pcm.grupos_quantitativos g where g.cliente_id = v_cliente and g.ativo and g.deleted_at is null
      and (p_apos is null or g.id > p_apos) and position(v_busca in pg_catalog.lower(g.nome)) > 0 order by g.id limit p_limite;
  end if;
end;
$$;
revoke all on function pcm.sso_listar_alvos_plano(uuid, text, integer, uuid, text) from public, anon;
grant execute on function pcm.sso_listar_alvos_plano(uuid, text, integer, uuid, text) to authenticated;
