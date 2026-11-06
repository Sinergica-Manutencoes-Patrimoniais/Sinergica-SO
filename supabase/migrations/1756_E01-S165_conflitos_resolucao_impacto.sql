-- ADR-1614: somente conflitos explicitamente levantados pelas APIs listadas.
do $patch$
declare r record;d text;a text;b text;
begin
 for r in select * from (values
 ('pcm.sso_resolver_impacto_retirada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)','revisao_obsoleta','P0011'),
 ('pcm.sso_resolver_impacto_retirada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)','decisao_obsoleta_ou_incompativel','P0015'),
 ('pcm.sso_consultar_resolucao_impacto(uuid,uuid,uuid,uuid,uuid,integer,integer,text)','revisao_obsoleta','P0011')
 ) x(assinatura,mensagem,codigo) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);a:=format('raise exception %L using errcode=%L',r.mensagem,'40001');b:=format('raise exception %L using errcode=%L',r.mensagem,r.codigo);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'resolucao_impacto_incompativel: % %',r.assinatura,r.mensagem using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
