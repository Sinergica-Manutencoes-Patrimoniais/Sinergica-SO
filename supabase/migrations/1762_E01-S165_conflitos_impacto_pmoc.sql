-- ADR-1620: conflitos conhecidos nas decisões e leituras PMOC.
do $patch$
declare r record;d text;a text;b text;
begin
 for r in select * from (values
 ('pcm.sso_listar_impactos_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer)','revisao_obsoleta','P0011'),
 ('pcm.sso_avaliar_impacto_pmoc(uuid,uuid,uuid,integer)','revisao_obsoleta','P0011'),
 ('pcm.sso_decidir_impacto_pmoc(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb)','revisao_obsoleta','P0011'),
 ('pcm.sso_decidir_impacto_pmoc(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb)','revisao_decisao_obsoleta','P0014'),
 ('pcm.sso_decidir_impacto_pmoc(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb)','fotografia_pmoc_alterada','P0013'),
 ('pcm.sso_classificar_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer,jsonb,text,text,text)','revisao_obsoleta','P0011'),
 ('pcm.sso_classificar_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer,jsonb,text,text,text)','revisao_decisao_obsoleta','P0014'),
 ('pcm.sso_classificar_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer,jsonb,text,text,text)','fotografia_pmoc_alterada','P0013')
 ) x(assinatura,mensagem,codigo) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);a:=format('raise exception %L using errcode=%L',r.mensagem,'40001');b:=format('raise exception %L using errcode=%L',r.mensagem,r.codigo);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'impacto_pmoc_incompativel: % %',r.assinatura,r.mensagem using errcode='55000';end if;execute replace(d,a,b);
 end loop;
end; $patch$;
