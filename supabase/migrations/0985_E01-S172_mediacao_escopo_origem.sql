-- ADR-0783: fonte e gates continuam privados e fechados.
create function pcm.sso_mediar_escopo_origem(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_expected_revision integer,
 p_executado text,p_restante text,p_justificativa text) returns jsonb language sql security definer set search_path='' as $$
 select pcm.sso_declarar_escopo_origem(p_request_id,p_cliente_id,p_os_id,p_expected_revision,p_executado,p_restante,p_justificativa);
$$;
create function pcm.sso_consultar_escopo_origem(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os pcm.ordens_servico%rowtype;v_origem jsonb;v_decl pcm.sso_escopo_origem_declaracoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_escopo_origem_gate where id),false) then raise exception 'escopo_origem_bloqueado' using errcode='55000';end if;
 if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
 if not found or v_os.ocorrencia_preventiva_id is null then raise exception 'origem_indisponivel' using errcode='23514';end if;
 v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
 select * into v_decl from pcm.sso_escopo_origem_declaracoes where os_id=p_os_id and cliente_id=p_cliente_id order by revisao desc limit 1;
 if found and v_decl.origem is distinct from v_origem then raise exception 'origem_alterada' using errcode='40001';end if;
 return jsonb_build_object('osId',p_os_id,'origem',v_origem,'revision',coalesce(v_decl.revisao,0),
  'executadoDeclarado',v_decl.executado_declarado,'restanteDeclarado',v_decl.restante_declarado,'execucaoComprovada',false);
end; $$;
revoke all on function pcm.sso_mediar_escopo_origem(uuid,uuid,uuid,integer,text,text,text) from public,anon,service_role;
revoke all on function pcm.sso_consultar_escopo_origem(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_mediar_escopo_origem(uuid,uuid,uuid,integer,text,text,text) to authenticated;
grant execute on function pcm.sso_consultar_escopo_origem(uuid,uuid) to authenticated;
