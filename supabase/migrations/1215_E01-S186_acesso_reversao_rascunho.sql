-- ADR-1067. Sem alteração dos gates nem exclusão de dados.
create function pcm.sso_consultar_rascunho_plano_legado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_m pcm.sso_rascunhos_planos_legados%rowtype;v_p pcm.planos_manutencao%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_reversao_rascunho_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_desabilitada' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_m from pcm.sso_rascunhos_planos_legados where plano_id=p_plano_id and cliente_id=p_cliente_id;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into v_p from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'origemRequestId',v_m.request_id,
    'revisao',v_p.revisao,'estado',v_p.estado,'versaoId',v_m.versao_id,'rotinaId',v_m.rotina_id);
end; $$;
revoke all on function pcm.sso_consultar_rascunho_plano_legado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_rascunho_plano_legado(uuid,uuid,uuid),pcm.sso_reverter_rascunho_plano_legado(uuid,uuid,uuid,uuid,integer,text) to authenticated;
