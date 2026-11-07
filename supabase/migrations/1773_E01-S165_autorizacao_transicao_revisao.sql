-- ADR-1631: nenhuma transição cruza revogação de autorização.
do $patch$
declare f regprocedure;d text;a text:=E'\nbegin\n';b text:=E'\nbegin\n  perform pcm.sso_serializar_autorizacao_rotina();\n';
begin
 foreach f in array array[
 'pcm.sso_iniciar_revisao_plano(uuid,integer,uuid,uuid)'::regprocedure,
 'pcm.sso_transicionar_revisao_plano(uuid,integer,uuid,text)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'autorizacao_revisao_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
