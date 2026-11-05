-- ADR-1444: reconhece o mesmo Chamado canônico nas leituras de retorno de Grupo.
do $migration$
declare v_def text;v_antigo text;v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure);
 v_antigo:='v_os.ocorrencia_preventiva_id is null and v_os.chamado_id is null';
 v_novo:='v_os.ocorrencia_preventiva_id is null and (v_os.chamado_id is null or v_os.chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,og.id))';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'classificador_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);

 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer)'::regprocedure);
 v_antigo:='os.ocorrencia_preventiva_id is null and os.chamado_id is null';
 v_novo:='os.ocorrencia_preventiva_id is null and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,og.id))';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'cobertura_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
