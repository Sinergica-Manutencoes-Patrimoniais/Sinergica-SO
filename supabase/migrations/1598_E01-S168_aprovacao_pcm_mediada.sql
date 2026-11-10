-- ADR-1455: aprovação mediada preserva o núcleo privado e seus pré-requisitos.
create function pcm.sso_atestar_aprovar_retorno_mediado(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 perform 1 from pcm.sso_atestacao_pcm_gate where id and habilitado for share;
 if not found then raise exception 'atestacao_pcm_bloqueada' using errcode='55000'; end if;
 v_resultado:=pcm.sso_atestar_aprovar_retorno_pcm(p_request_id,p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_atestar_aprovar_retorno_mediado(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atestar_aprovar_retorno_mediado(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;

do $migration$
declare v_def text;v_antigo text:='v_aprovacao := pcm.sso_atestar_aprovar_retorno_pcm(';v_novo text:='v_aprovacao := pcm.sso_atestar_aprovar_retorno_mediado(';
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_finalizar_os_atomico(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text,timestamptz)'::regprocedure);
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'aprovacao_atomica_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
