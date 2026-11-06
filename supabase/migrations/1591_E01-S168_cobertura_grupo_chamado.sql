-- ADR-1448: a guarda de cobertura aceita exclusivamente o Chamado do mesmo ciclo.
do $migration$
declare v_def text;v_antigo text;v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_guardar_cobertura_validacao_os()'::regprocedure);
 v_antigo:='os.ocorrencia_preventiva_id is null and os.chamado_id is null';
 v_novo:='os.ocorrencia_preventiva_id is null and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(v_retorno.cliente_id,og.id))';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'guarda_cobertura_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_guardar_cobertura_validacao_os() from public,anon,authenticated,service_role;
