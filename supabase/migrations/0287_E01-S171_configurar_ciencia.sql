-- ADR-0063: configuração idempotente, sem confirmar ou enviar Visitas.
create function pcm.sso_configurar_ciencia_visita(
  p_request_id uuid, p_expected_revision integer, p_politica_id uuid, p_cliente_id uuid,
  p_contrato_id uuid, p_visita_id uuid, p_modo text
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_comando pcm.visita_comandos%rowtype;
  v_antes pcm.politicas_ciencia_visita%rowtype; v_depois pcm.politicas_ciencia_visita%rowtype;
  v_payload jsonb; v_resultado jsonb; v_novo boolean;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_politica_id is null or p_cliente_id is null or p_modo is null
    or p_modo not in ('sem_controle', 'informativa', 'obrigatoria')
    or (p_contrato_id is not null and p_visita_id is not null) then
    raise exception 'politica_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'configurarCiencia', 'expectedRevision', p_expected_revision,
    'politicaId', p_politica_id, 'clienteId', p_cliente_id, 'contratoId', p_contrato_id,
    'visitaId', p_visita_id, 'modo', p_modo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id) then
    raise exception 'escopo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'escopo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:' || p_cliente_id::text || ':' ||
    coalesce(p_contrato_id::text, '-') || ':' || coalesce(p_visita_id::text, '-'), 0));
  if p_contrato_id is not null then
    perform 1 from comercial.contratos where id = p_contrato_id and cliente_id = p_cliente_id for share;
    if not found then raise exception 'escopo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  end if;
  if p_visita_id is not null then
    perform 1 from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id for share;
    if not found then raise exception 'escopo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  end if;
  select * into v_antes from pcm.politicas_ciencia_visita
    where cliente_id = p_cliente_id and contrato_id is not distinct from p_contrato_id
      and visita_id is not distinct from p_visita_id for update;
  v_novo := not found;
  if v_novo then
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    insert into pcm.politicas_ciencia_visita(id, cliente_id, contrato_id, visita_id, modo, created_by, updated_by)
      values (p_politica_id, p_cliente_id, p_contrato_id, p_visita_id, p_modo, v_actor, v_actor) returning * into v_depois;
  else
    if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    if v_antes.id <> p_politica_id then raise exception 'politica_conflitante' using errcode = '23505'; end if;
    update pcm.politicas_ciencia_visita set modo = p_modo, revisao = revisao + 1, updated_at = now(), updated_by = v_actor
      where id = v_antes.id returning * into v_depois;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_depois.id, 'revision', v_depois.revisao, 'state', 'configurada',
    'created', v_novo, 'linkedIds', jsonb_build_object('clienteId', p_cliente_id), 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, case when v_novo then 'ciencia.politica_criada' else 'ciencia.politica_alterada' end,
     'politicas_ciencia_visita', v_depois.id, jsonb_build_object('requestId', p_request_id,
       'antes', case when v_novo then null else to_jsonb(v_antes) end, 'depois', to_jsonb(v_depois)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_configurar_ciencia_visita(uuid, integer, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function pcm.sso_configurar_ciencia_visita(uuid, integer, uuid, uuid, uuid, uuid, text) to authenticated;
