-- ADR-0544: data futura conforme fuso congelado da versão anterior.
create or replace function pcm.sso_aprovar_revisao_preparada(
  p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_vigencia date
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_plano pcm.planos_manutencao%rowtype;
  v_anterior pcm.plano_versoes%rowtype; v_comando pcm.plano_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_hoje date;
begin
  if not coalesce((select habilitado from pcm.aprovacao_revisao_gate where id), false) then
    raise exception 'aprovacao_revisao_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_plano_id is null or p_vigencia is null or not isfinite(p_vigencia) then
    raise exception 'aprovacao_invalida' using errcode = '22023'; end if;
  -- Mesmo envelope do comando de aprovação existente, para preservar retry idêntico.
  v_payload := jsonb_build_object('tipo', 'aprovarPlano', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'vigencia', p_vigencia);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) is distinct from true then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_plano.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_plano.estado <> 'em_revisao' then raise exception 'estado_incompativel' using errcode = '22023'; end if;
  select * into v_anterior from pcm.plano_versoes where plano_id = p_plano_id and estado = 'aprovado'
    order by numero desc limit 1 for update;
  if not found then raise exception 'versao_anterior_indisponivel' using errcode='23514'; end if;
  v_hoje:=pcm.sso_data_civil_versao_geracao(p_plano_id,v_anterior.id);
  if v_anterior.vigencia_inicio is null or not isfinite(v_anterior.vigencia_inicio)
    or v_anterior.vigencia_fim is not null or p_vigencia <= v_anterior.vigencia_inicio
    or p_vigencia <= v_hoje then raise exception 'vigencia_insegura' using errcode = '23514'; end if;
  -- Token transacional privado, reconhecido pelas proteções da migration 0345.
  insert into pcm.aprovacao_revisao_tokens(txid, plano_id, versao_anterior_id, vigencia_inicio)
    values (pg_catalog.txid_current(), p_plano_id, v_anterior.id, p_vigencia);
  update pcm.plano_versoes set vigencia_fim = p_vigencia - 1 where id = v_anterior.id;
  v_resultado := pcm.sso_aprovar_plano(p_request_id, p_expected_revision, p_plano_id, p_vigencia);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'plano.vigencia_anterior_encerrada', 'planos_manutencao', p_plano_id,
      jsonb_build_object('requestId', p_request_id, 'versaoAnteriorId', v_anterior.id,
        'fimAnterior', v_anterior.vigencia_fim, 'novoFim', p_vigencia - 1));
  delete from pcm.aprovacao_revisao_tokens where txid = pg_catalog.txid_current() and plano_id = p_plano_id;
  return v_resultado;
end;
$$;

