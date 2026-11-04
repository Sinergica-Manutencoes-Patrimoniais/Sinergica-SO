-- ADR-1484: somente entrada/retorno à fila exige continuidade vigente.
do $migracao$
declare v_item record;v_def text;v_antes text:='v_estado:=pcm.sso_estado_ocorrencia_vinculada(p_cliente_id,p_plano_id,p_preparada_id);';
 v_depois text:=E'perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente_id,p_preparada_id,''calendario'');\n  v_estado:=pcm.sso_estado_ocorrencia_vinculada(p_cliente_id,p_plano_id,p_preparada_id);';
begin
 for v_item in select * from (values
 ('pcm.sso_alterar_fila_preventiva_pcm(uuid,uuid,uuid,uuid,text,integer,text)'),
 ('pcm.sso_confirmar_fila_preventiva(uuid,uuid,uuid,uuid,integer,text)')
 ) t(assinatura) loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_fila_incompativel: %',v_item.assinatura using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;
