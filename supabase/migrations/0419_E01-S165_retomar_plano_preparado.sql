-- ADR-0193: amplia histórico preparado e adiciona transição sem materialização retroativa.
alter table pcm.plano_transicoes_historico drop constraint plano_transicoes_historico_acao_check;
alter table pcm.plano_transicoes_historico add constraint plano_transicoes_historico_acao_check
  check(acao in ('suspender','encerrar','retomar'));

create function pcm.sso_retomar_plano_preparado(p_request_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' set timezone='America/Sao_Paulo' as $$
declare v_actor uuid:=auth.uid(); v_antes pcm.planos_manutencao%rowtype; v_depois pcm.planos_manutencao%rowtype;
  v_comando pcm.plano_comandos%rowtype; v_suspensao pcm.plano_transicoes_historico%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.plano_transicao_gate where id),false) then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1
    or p_vigencia is null or not isfinite(p_vigencia) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'transicao_invalida' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','retomarPlanoPreparado','planoId',p_plano_id,'expectedRevision',p_expected_revision,
    'vigencia',p_vigencia,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request_id::text,0));
  select * into v_comando from pcm.plano_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_comando.cliente_id) is distinct from true then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_antes from pcm.planos_manutencao where id=p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_antes.cliente_id) is distinct from true then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_antes.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_antes.estado<>'suspenso' or p_vigencia<>current_date then raise exception 'transicao_exige_reconciliacao' using errcode='23514'; end if;
  select * into v_suspensao from pcm.plano_transicoes_historico where plano_id=p_plano_id order by revisao desc limit 1;
  if not found or v_suspensao.acao<>'suspender' or v_suspensao.estado_anterior not in ('aprovado','ativo')
    or v_suspensao.revisao<>v_antes.revisao then raise exception 'suspensao_sem_historico_coerente' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',v_antes.cliente_id) is distinct from true then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  update pcm.planos_manutencao set estado=v_suspensao.estado_anterior,revisao=revisao+1,updated_at=now(),updated_by=v_actor
    where id=p_plano_id returning * into v_depois;
  insert into pcm.plano_transicoes_historico(plano_id,revisao,acao,estado_anterior,estado_novo,vigencia,motivo,request_id,ator_id)
    values(p_plano_id,v_depois.revisao,'retomar',v_antes.estado,v_depois.estado,p_vigencia,btrim(p_motivo),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('aggregateId',p_plano_id,'revision',v_depois.revisao,'state',v_depois.estado,'created',false,
    'linkedIds',jsonb_build_object('clienteId',v_depois.cliente_id),
    'warnings',jsonb_build_array('vencidos_dependem_decisao_pcm','geradores_legados_exigem_reconciliacao'),'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.retomar','planos_manutencao',p_plano_id,
    jsonb_build_object('requestId',p_request_id,'revision',v_depois.revisao,'vigencia',p_vigencia,'motivo',btrim(p_motivo)));
  insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_depois.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_retomar_plano_preparado(uuid,uuid,integer,date,text) from public,anon,authenticated,service_role;
