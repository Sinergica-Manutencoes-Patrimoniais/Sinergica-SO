-- ADR-1445: pendência de Grupo reconhece Chamado do ciclo, sem admitir outro Chamado.
do $migration$
declare v_def text;v_antigo text;v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure);
 v_antigo:='os.ocorrencia_preventiva_id is null and os.chamado_id is null';
 v_novo:='os.ocorrencia_preventiva_id is null and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(v_retorno.cliente_id,og.id))';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'pendencia_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);

 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_descricao_historica_pendencia(uuid,uuid)'::regprocedure);
 v_antigo:='os.ocorrencia_preventiva_id is null and os.chamado_id is null';
 v_novo:='os.ocorrencia_preventiva_id is null and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,p.ocorrencia_grupo_id))';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'descricao_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_descricao_historica_pendencia(uuid,uuid) from public,anon,authenticated,service_role;
