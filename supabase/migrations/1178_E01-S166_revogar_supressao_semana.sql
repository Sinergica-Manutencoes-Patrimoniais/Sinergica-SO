-- ADR-1027: revogação declarada, sem geração automática.
create function pcm.sso_revogar_supressao_semana(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_supressao_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_s pcm.sso_supressoes_semana_feriado%rowtype;v_r pcm.sso_revogacoes_supressao_semana%rowtype;v_f pcm.feriados_declarados%rowtype;v_contrato uuid;v_motivo text;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_supressao_id is null or p_motivo is null or pg_catalog.length(pg_catalog.btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_supressao_semana_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_motivo:=pg_catalog.btrim(p_motivo);
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('revogacao-supressao-request:'||p_request_id::text,0)) then raise exception 'pedido_em_alteracao' using errcode='55P03'; end if;
  select * into v_s from pcm.sso_supressoes_semana_feriado where id=p_supressao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'supressao_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_r from pcm.sso_revogacoes_supressao_semana where request_id=p_request_id;
  if found then
    if v_r.ator_id is distinct from p_ator_id or v_r.supressao_id is distinct from p_supressao_id or v_r.motivo is distinct from v_motivo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,'supressaoId',p_supressao_id,'revogada',true,'visitaCriada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||v_s.serie_id::text||':'||v_s.semana_origem::text,0)) then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
  select s.contrato_id into v_contrato from pcm.calendario_contratual_series s where s.id=v_s.serie_id and s.cliente_id=p_cliente_id for share nowait;
  if v_contrato is null then raise exception 'serie_indisponivel' using errcode='23514'; end if;
  select * into v_f from pcm.feriados_declarados where id=v_s.feriado_id and cliente_id=p_cliente_id;
  if not found or v_f.ativo then raise exception 'feriado_original_ainda_ativo_ou_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo and f.data=v_s.data_contratual and (f.contrato_id is null or f.contrato_id=v_contrato)) then raise exception 'outro_feriado_declarado_ativo' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_revogacoes_supressao_semana where supressao_id=p_supressao_id) then raise exception 'supressao_ja_revogada' using errcode='23505'; end if;
  insert into pcm.sso_revogacoes_supressao_semana(supressao_id,request_id,ator_id,motivo) values(p_supressao_id,p_request_id,p_ator_id,v_motivo);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'calendario.supressao_revogada','calendario_contratual_series',v_s.serie_id,pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'requestId',p_request_id,'supressaoId',p_supressao_id,'motivo',v_motivo));
  return pg_catalog.jsonb_build_object('requestId',p_request_id,'supressaoId',p_supressao_id,'revogada',true,'visitaCriada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
end;
$$;
revoke all on function pcm.sso_revogar_supressao_semana(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
