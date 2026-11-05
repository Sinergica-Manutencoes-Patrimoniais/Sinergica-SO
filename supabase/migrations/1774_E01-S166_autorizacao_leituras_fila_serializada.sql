-- ADR-1632: leituras legadas da fila não cruzam revogação de acesso.
do $patch$
declare f regprocedure;d text;a text:=E'\nbegin\n';b text:=E'\nbegin\n  perform pcm.sso_serializar_autorizacao_geracao();\n';
begin
 foreach f in array array[
  'pcm.sso_listar_fila_preventiva_pcm(uuid,uuid,uuid,integer)'::regprocedure,
  'pcm.sso_consultar_fila_visita(uuid,uuid,uuid)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
   raise exception 'leitura_fila_autorizacao_incompativel: %',f using errcode='55000';
  end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
