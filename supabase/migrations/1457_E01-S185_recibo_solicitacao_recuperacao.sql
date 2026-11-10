-- ADR-1310: consulta de recibo sem repetir o comando.
create function pcm.sso_recibo_solicitacao_recuperacao(
  p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_request_id uuid,p_epoca uuid,p_revisao text,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_solicitacoes_recuperacao%rowtype;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_outbox_id is null
    or p_request_id is null or p_epoca is null or p_revisao is null or p_revisao !~ '^(0|[1-9][0-9]{0,18})$'
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_solicitacao_recuperacao_gate where id and habilitado for share;
  if not found then raise exception 'solicitacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_revisao_fila_gate where id and habilitado for share;
  if not found then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'outboxId',p_outbox_id,'epoca',p_epoca,'revisao',p_revisao,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-solicitacao-recuperacao:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_solicitacoes_recuperacao where request_id=p_request_id;
  if not found then return null; end if;
  if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then
    raise exception 'sem_acesso_ou_tentativa_divergente' using errcode='42501'; end if;
  perform pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
end; $$;
revoke all on function pcm.sso_recibo_solicitacao_recuperacao(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_solicitacao_recuperacao(uuid,uuid,uuid,uuid,uuid,text,text) to authenticated;
