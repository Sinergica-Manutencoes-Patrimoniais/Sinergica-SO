-- ADR-0065: edição pré-confirmação sem alterar contratos ou integrações.
create function pcm.sso_editar_visita(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_area_id uuid, p_local_id uuid,
  p_inicio_em timestamptz, p_fim_em timestamptz, p_fuso text, p_responsavel_id uuid, p_deslocamento_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.visitas%rowtype; v_visita pcm.visitas%rowtype;
  v_comando pcm.visita_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_visita_id is null
    or p_inicio_em is null or p_fim_em is null or not isfinite(p_inicio_em) or not isfinite(p_fim_em)
    or p_fim_em <= p_inicio_em or nullif(btrim(p_fuso), '') is null
    or p_deslocamento_minutos is null or p_deslocamento_minutos < 0 then
    raise exception 'visita_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'editarVisita', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'areaId', p_area_id, 'localId', p_local_id,
    'inicioEm', p_inicio_em, 'fimEm', p_fim_em, 'fuso', p_fuso,
    'responsavelId', p_responsavel_id, 'deslocamentoMinutos', p_deslocamento_minutos);
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
  if v_antes.estado not in ('rascunho', 'planejada') then raise exception 'visita_nao_editavel' using errcode = '22023'; end if;
  if p_responsavel_id is not null then
    perform 1 from pcm.funcionarios f where f.id = p_responsavel_id and f.ativo and f.deleted_at is null for share;
    if not found then raise exception 'responsavel_invalido' using errcode = '23514'; end if;
  end if;
  update pcm.visitas set area_id = p_area_id, local_id = p_local_id, inicio_em = p_inicio_em, fim_em = p_fim_em,
    fuso = p_fuso, responsavel_id = p_responsavel_id, deslocamento_minutos = p_deslocamento_minutos,
    revisao = revisao + 1, updated_at = now(), updated_by = v_actor where id = p_visita_id returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.editada', 'visitas', p_visita_id,
      jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_visita)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_editar_visita(uuid, integer, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, integer) from public, anon;
grant execute on function pcm.sso_editar_visita(uuid, integer, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, integer) to authenticated;
