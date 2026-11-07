-- ADR-1243: consulta do mesmo pedido sem repetir cancelamento.
create function pcm.sso_recibo_cancelamento_aceite_lote(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_aceite_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_aceite_id is null
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_cancelamento_aceite_lote_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_aceite_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'aceite_desabilitado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select c.resultado into v_resultado from pcm.sso_cancelamentos_aceite_lote c
    join pcm.sso_aceites_lote_legado a on a.request_id=c.aceite_id and a.cliente_id=c.cliente_id and a.ator_id=c.ator_id
    where c.request_id=p_request_id and c.aceite_id=p_aceite_id and c.ator_id=p_ator_id and c.cliente_id=p_cliente_id and c.motivo=v_motivo;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_recibo_cancelamento_aceite_lote(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_cancelamento_aceite_lote(uuid,uuid,uuid,uuid,text) to authenticated;
