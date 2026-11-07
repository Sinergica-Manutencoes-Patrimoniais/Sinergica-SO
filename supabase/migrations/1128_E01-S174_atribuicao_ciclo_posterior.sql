-- ADR-0977: caminho privado para atribuir apenas parcela de ciclo posterior.
create function pcm.sso_atribuir_parcela_ciclo(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,
  p_parcela_id uuid,p_os_id uuid,p_chamado_revision bigint,p_escopo_revision bigint,p_os_status text,p_os_atualizada_em timestamptz,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;
  v_escopo pcm.chamado_escopo_composicoes%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;v_os pcm.ordens_servico%rowtype;
  v_ant pcm.sso_atribuicoes_parcela%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_atribuicao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'atribuicao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_ciclo_id is null
    or p_parcela_id is null or p_os_id is null or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1
    or p_os_status is null or p_os_atualizada_em is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'chamadoRevision',p_chamado_revision,
    'escopoRevision',p_escopo_revision,'osStatus',p_os_status,'osAtualizadaEm',p_os_atualizada_em,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atribuicao-parcela:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_atribuicoes_parcela where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_ant.payload is distinct from v_payload or not exists(select 1 from pcm.sso_ciclos_backlog c where c.id=p_ciclo_id and c.parcela_id=v_ant.parcela_id and c.cliente_id=p_cliente_id and c.legado_pendencia_id is null) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id and legado_pendencia_id is null;
  if not found then raise exception 'ciclo_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id for update;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id and parcela_id=p_parcela_id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_os from pcm.ordens_servico where id=p_os_id and chamado_id=v_chamado.id and client_id=p_cliente_id and deleted_at is null for update;
  if v_escopo.chamado_id is null or v_escopo.revisao is distinct from p_escopo_revision or v_chamado.sso_revisao is distinct from p_chamado_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_ciclo.legado_pendencia_id is not null or v_parcela.id is null or v_parcela.situacao<>'pendente'
    or v_os.id is null or v_os.status is distinct from p_os_status or v_os.updated_at is distinct from p_os_atualizada_em or v_os.status in ('finalizado','cancelado')
    or pcm.sso_ciclo_promocao_valida(p_cliente_id,v_ciclo.id,v_chamado.id,v_parcela.id) is distinct from true
    then raise exception 'escopo_ou_os_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_atribuicoes_parcela(parcela_id,os_id,chamado_id,cliente_id,ator_id,request_id,payload)
    values(p_parcela_id,p_os_id,v_chamado.id,p_cliente_id,v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.parcela_atribuida','chamados',v_chamado.id,
    v_resultado||jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_atribuir_parcela_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,text,timestamptz,text) from public,anon,authenticated,service_role;
