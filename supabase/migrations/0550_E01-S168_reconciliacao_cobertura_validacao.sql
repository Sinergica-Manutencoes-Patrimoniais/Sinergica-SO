-- ADR-0324: diagnóstico conservador; não aprova retorno nem encerra OS.
create function pcm.sso_reconciliar_cobertura_validacao(p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_conferencia pcm.sso_conferencias_cobertura_retorno%rowtype;v_revisao integer;v_decisoes integer;v_versionadas integer;v_ultima integer;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_conferencia_cobertura_retorno_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_conferencia from pcm.sso_conferencias_cobertura_retorno where id=p_conferencia_id and retorno_id=p_retorno_id;
 if not found then raise exception 'conferencia_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 select count(*) into v_decisoes from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_ultima from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 return jsonb_build_object('conferenciaId',p_conferencia_id,'revisaoConferida',v_conferencia.revisao_evidencias,'revisaoEvidenciasAtual',v_revisao,'conferenciaDesatualizada',v_conferencia.revisao_evidencias<>v_revisao,
  'historicoVersionadoCompleto',v_decisoes=v_versionadas,'revisaoValidacao',v_ultima,'evidenciaExternaAutenticada',false,'aprovacaoDisponivel',false,
  'impedimentos',jsonb_build_array('vinculo_e_snapshot_exigem_revalidacao_transacional','autenticidade_e_politica_de_evidencias_nao_comprovadas','encerramento_nao_homologado'));
end; $$;
revoke all on function pcm.sso_reconciliar_cobertura_validacao(uuid,uuid,uuid) from public,anon,authenticated,service_role;
