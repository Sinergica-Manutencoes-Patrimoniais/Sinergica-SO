-- ADR-0046: transições preparatórias, sem aprovação nem execução externa.
create function pcm.sso_transicionar_revisao_plano(
  p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_acao text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_plano pcm.planos_manutencao%rowtype;
  v_antes pcm.planos_manutencao%rowtype;
  v_comando pcm.plano_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_novo_estado text;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_plano_id is null or p_acao is null or p_acao not in ('submeter', 'devolver') then
    raise exception 'transicao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'transicionarRevisaoPlano', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'acao', p_acao);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_antes from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_antes.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if (p_acao = 'submeter' and v_antes.estado <> 'rascunho')
    or (p_acao = 'devolver' and v_antes.estado <> 'em_revisao') then
    raise exception 'estado_incompativel' using errcode = '22023';
  end if;
  v_novo_estado := case p_acao when 'submeter' then 'em_revisao' else 'rascunho' end;
  update pcm.planos_manutencao set estado = v_novo_estado, revisao = revisao + 1,
    updated_at = now(), updated_by = v_actor where id = p_plano_id returning * into v_plano;
  v_resultado := jsonb_build_object('aggregateId', p_plano_id, 'revision', v_plano.revisao,
    'state', v_plano.estado, 'created', false, 'linkedIds', jsonb_build_object('clienteId', v_plano.cliente_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, case p_acao when 'submeter' then 'plano.submetido_revisao' else 'plano.devolvido_rascunho' end,
      'planos_manutencao', p_plano_id, jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_plano)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_transicionar_revisao_plano(uuid, integer, uuid, text) from public, anon;
grant execute on function pcm.sso_transicionar_revisao_plano(uuid, integer, uuid, text) to authenticated;
