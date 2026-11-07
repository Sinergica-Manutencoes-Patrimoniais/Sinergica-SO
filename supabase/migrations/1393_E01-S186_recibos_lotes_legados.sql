-- ADR-1240: leitura do recibo pelo próprio ator, sem repetir comandos.
create function pcm.sso_recibo_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_aceite_id uuid,p_lote_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_aceite_id is null or p_lote_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_aceite_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'aceite_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_lote_rascunhos_legados_gate where id and habilitado for share;
  if not found then raise exception 'lote_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.resultado into v_resultado from pcm.sso_aceites_execucoes_lote_legado v
    join pcm.sso_lotes_rascunhos_legados l on l.request_id=v.lote_id and l.cliente_id=v.cliente_id and l.ator_id=v.ator_id
    where v.aceite_id=p_aceite_id and v.lote_id=p_lote_id and v.cliente_id=p_cliente_id and v.ator_id=p_ator_id;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_recibo_lote_legado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_recibo_reversao_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lote_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if p_request_id is null or p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_consulta_reversao_lote(p_ator_id,p_cliente_id);
  select r.resultado into v_resultado from pcm.sso_reversoes_lote_legado r
    join pcm.sso_lotes_rascunhos_legados l on l.request_id=r.lote_request_id and l.cliente_id=r.cliente_id
    where r.request_id=p_request_id and r.lote_request_id=p_lote_id and r.cliente_id=p_cliente_id and r.ator_id=p_ator_id;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_recibo_reversao_lote_legado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_lote_legado(uuid,uuid,uuid,uuid),pcm.sso_recibo_reversao_lote_legado(uuid,uuid,uuid,uuid) to authenticated;
