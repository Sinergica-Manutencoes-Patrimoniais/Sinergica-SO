-- ADR-0611: consulta de staging, não aprovação ou execução.
create function pcm.sso_consultar_intencao_os_grupo(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_i pcm.sso_intencoes_os_grupo%rowtype;v_d pcm.sso_decisoes_intencao_grupo%rowtype;v_v pcm.sso_vinculos_os_grupo%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_intencao_os_grupo_gate where id),false) then raise exception 'intencao_os_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_i from pcm.sso_intencoes_os_grupo where ocorrencia_grupo_id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if v_i.id is not null then select * into v_d from pcm.sso_decisoes_intencao_grupo where intencao_id=v_i.id and cliente_id=p_cliente_id; end if;
 select * into v_v from pcm.sso_vinculos_os_grupo where ocorrencia_grupo_id=p_ocorrencia_id and cliente_id=p_cliente_id;
 return jsonb_build_object('intencao',case when v_i.id is null then null else jsonb_build_object('id',v_i.id,'titulo',v_i.titulo,'motivo',v_i.motivo,'grupoRevisao',v_i.grupo_revisao,'quantidade',v_i.quantidade_snapshot::text,'criadoEm',v_i.criado_em) end,
 'decisao',case when v_d.request_id is null then null else jsonb_build_object('requestId',v_d.request_id,'osId',v_d.os_id,'motivo',v_d.motivo,'criadoEm',v_d.criado_em) end,
 'vinculo',case when v_v.request_id is null then null else jsonb_build_object('requestId',v_v.request_id,'osId',v_v.os_id,'criadoEm',v_v.criado_em) end,
 'execucaoAutorizada',false,'osCriada',false);
end; $$;
revoke all on function pcm.sso_consultar_intencao_os_grupo(uuid,uuid) from public,anon,authenticated,service_role;
