-- ADR-0034: consulta intermediada, paginada e sujeita à autorização atual.
create function pcm.sso_listar_historico_estrutura(
  p_tipo text, p_id uuid, p_limite integer, p_antes timestamptz, p_antes_id uuid
) returns table(evento_id uuid, ocorrido_em timestamptz, acao text, ator_id uuid, antes jsonb, depois jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_entidade text;
begin
  if p_tipo not in ('grupo', 'componente') or p_id is null or p_limite is null or p_limite < 1 or p_limite > 100
    or ((p_antes is null) <> (p_antes_id is null)) then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if p_tipo = 'grupo' then
    select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id = p_id;
    v_entidade := 'grupos_quantitativos';
  else
    select e.client_id into v_cliente from pcm.equipamentos e where e.id = p_id;
    v_entidade := 'equipamentos';
  end if;
  if v_cliente is null or not (config.sso_autorizar_acao('cadastro.ler', v_cliente)
    or config.sso_autorizar_acao('cadastro.gerir', v_cliente)) then
    raise exception 'historico_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query
    select e.id, e.created_at, e.action, e.actor_id,
      case when e.payload -> 'antes' = 'null'::jsonb then null else
        jsonb_strip_nulls(jsonb_build_object('cliente_id', e.payload -> 'antes' -> 'cliente_id',
          'area_id', e.payload -> 'antes' -> 'area_id', 'local_id', e.payload -> 'antes' -> 'local_id',
          'parent_item_id', e.payload -> 'antes' -> 'parent_item_id', 'sistema_id', e.payload -> 'antes' -> 'sistema_id',
          'categoria_id', e.payload -> 'antes' -> 'categoria_id', 'nome', e.payload -> 'antes' -> 'nome',
          'quantidade', e.payload -> 'antes' -> 'quantidade', 'caracteristicas', e.payload -> 'antes' -> 'caracteristicas',
          'ativo', e.payload -> 'antes' -> 'ativo', 'deleted_at', e.payload -> 'antes' -> 'deleted_at')) end,
      jsonb_strip_nulls(jsonb_build_object('cliente_id', e.payload -> 'depois' -> 'cliente_id',
        'area_id', e.payload -> 'depois' -> 'area_id', 'local_id', e.payload -> 'depois' -> 'local_id',
        'parent_item_id', e.payload -> 'depois' -> 'parent_item_id', 'sistema_id', e.payload -> 'depois' -> 'sistema_id',
        'categoria_id', e.payload -> 'depois' -> 'categoria_id', 'nome', e.payload -> 'depois' -> 'nome',
        'quantidade', e.payload -> 'depois' -> 'quantidade', 'caracteristicas', e.payload -> 'depois' -> 'caracteristicas',
        'ativo', e.payload -> 'depois' -> 'ativo', 'deleted_at', e.payload -> 'depois' -> 'deleted_at'))
    from audit.events e
    where e.entity = v_entidade and e.entity_id = p_id
      and ((p_tipo = 'grupo' and e.action in ('grupo.criado', 'grupo.atualizado'))
        or (p_tipo = 'componente' and e.action = 'estrutura.movimentada'))
      and (p_antes is null or (e.created_at, e.id) < (p_antes, p_antes_id))
      and (p_tipo <> 'componente' or
        ((e.payload -> 'antes' ->> 'cliente_id' is null or
          config.sso_autorizar_acao('cadastro.ler', (e.payload -> 'antes' ->> 'cliente_id')::uuid) or
          config.sso_autorizar_acao('cadastro.gerir', (e.payload -> 'antes' ->> 'cliente_id')::uuid))
        and (e.payload -> 'depois' ->> 'cliente_id' is null or
          config.sso_autorizar_acao('cadastro.ler', (e.payload -> 'depois' ->> 'cliente_id')::uuid) or
          config.sso_autorizar_acao('cadastro.gerir', (e.payload -> 'depois' ->> 'cliente_id')::uuid))))
    order by e.created_at desc, e.id desc limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_historico_estrutura(text, uuid, integer, timestamptz, uuid) from public, anon;
grant execute on function pcm.sso_listar_historico_estrutura(text, uuid, integer, timestamptz, uuid) to authenticated;
