-- ADR-0066: planejar não confirma nem gera intenção externa.
create function pcm.sso_planejar_visita(p_request_id uuid, p_expected_revision integer, p_visita_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.visitas%rowtype; v_visita pcm.visitas%rowtype;
  v_comando pcm.visita_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_visita_id is null then
    raise exception 'planejamento_invalido' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'planejarVisita', 'expectedRevision', p_expected_revision, 'visitaId', p_visita_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_antes from pcm.visitas where id = p_visita_id for update;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_antes.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_antes.estado <> 'rascunho' then raise exception 'transicao_invalida' using errcode = '22023'; end if;
  update pcm.visitas set estado = 'planejada', revisao = revisao + 1, updated_at = now(), updated_by = v_actor
    where id = p_visita_id returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id), 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.planejada', 'visitas', p_visita_id,
      jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_visita)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_planejar_visita(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_planejar_visita(uuid, integer, uuid) to authenticated;
