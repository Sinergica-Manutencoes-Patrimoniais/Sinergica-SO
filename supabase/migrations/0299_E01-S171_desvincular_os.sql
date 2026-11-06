-- ADR-0074: encerra vínculo preservando histórico e sem alterar a OS.
create function pcm.sso_desvincular_os_visita(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_vinculo_id uuid, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.visitas%rowtype; v_visita pcm.visitas%rowtype;
  v_comando pcm.visita_comandos%rowtype; v_vinculo pcm.visita_ordens_servico%rowtype;
  v_payload jsonb; v_resultado jsonb; v_motivo text := nullif(btrim(p_motivo), '');
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_visita_id is null or p_vinculo_id is null or v_motivo is null or length(v_motivo) > 2000 then
    raise exception 'desvinculacao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'desvincularOsVisita', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'vinculoId', p_vinculo_id, 'motivo', v_motivo);
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
  update pcm.visita_ordens_servico set encerrado_em = now(), encerrado_por = v_actor, encerramento_motivo = v_motivo
    where id = p_vinculo_id and visita_id = p_visita_id and cliente_id = v_antes.cliente_id and encerrado_em is null
    returning * into v_vinculo;
  if not found then raise exception 'vinculo_inexistente_ou_encerrado' using errcode = '23514'; end if;
  update pcm.visitas set revisao = revisao + 1, updated_at = now(), updated_by = v_actor
    where id = p_visita_id returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id, 'vinculoId', p_vinculo_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.os_desvinculada', 'visitas', p_visita_id,
      jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_visita), 'vinculo', to_jsonb(v_vinculo)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_desvincular_os_visita(uuid, integer, uuid, uuid, text) from public, anon;
grant execute on function pcm.sso_desvincular_os_visita(uuid, integer, uuid, uuid, text) to authenticated;
