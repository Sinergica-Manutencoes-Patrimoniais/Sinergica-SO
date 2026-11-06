-- ADR-1657: reforço aditivo, sem aplicar comandos ou alterar ACL da função.
create or replace function pcm.sso_mover_componente(p_request_id uuid, p_expected_revision integer, p_id uuid,
  p_area_id uuid, p_local_id uuid, p_parent_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_item pcm.equipamentos%rowtype; v_comando pcm.estrutura_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_area_local uuid;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if v_actor is null or p_request_id is null or p_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'comando_invalido' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  v_payload := jsonb_build_object('tipo', 'moverComponente', 'expectedRevision', p_expected_revision,
    'id', p_id, 'areaId', p_area_id, 'localId', p_local_id, 'parentId', p_parent_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_item from pcm.equipamentos where id = p_id for update;
  if not found or v_item.client_id is null or config.sso_autorizar_acao('cadastro.gerir', v_item.client_id) is not true then
    raise exception 'componente_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_comando from pcm.estrutura_comandos where request_id = p_request_id;
  if found then
    if config.sso_autorizar_acao('cadastro.gerir', (v_comando.resultado -> 'linkedIds' ->> 'clienteId')::uuid) is not true then
      raise exception 'comando_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.actor_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_item.deleted_at is not null or not v_item.ativo then raise exception 'componente_indisponivel' using errcode = '22023'; end if;
  if v_item.estrutura_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_local_id is not null then
    select l.area_id into v_area_local from pcm.locais l where l.id = p_local_id and l.ativo and l.deleted_at is null for share;
    if v_area_local is null or v_area_local is distinct from p_area_id then raise exception 'local_area_invalido' using errcode = '23514'; end if;
  end if;
  update pcm.equipamentos set area_id = p_area_id, local_id = p_local_id, parent_item_id = p_parent_id,
    updated_at = now(), updated_by = v_actor where id = p_id returning * into v_item;
  v_resultado := jsonb_build_object('aggregateId', v_item.id, 'revision', v_item.estrutura_revisao,
    'state', v_item.ativo, 'created', false,
    'linkedIds', jsonb_strip_nulls(jsonb_build_object('clienteId', v_item.client_id, 'areaId', v_item.area_id,
      'localId', v_item.local_id, 'parentId', v_item.parent_item_id)), 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'estrutura.comando', 'equipamentos', p_id,
      jsonb_build_object('requestId', p_request_id, 'revision', v_item.estrutura_revisao));
  insert into pcm.estrutura_comandos(request_id, actor_id, payload, resultado) values (p_request_id, v_actor, v_payload, v_resultado);
  return v_resultado;
end;
$$;
