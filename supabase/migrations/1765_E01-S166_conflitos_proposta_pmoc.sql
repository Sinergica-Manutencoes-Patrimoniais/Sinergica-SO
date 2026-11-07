-- ADR-1623: apenas conflitos conhecidos, sem alterar serializações reais.
do $patch$
declare r record;d text;a text;b text;
begin
 for r in select * from (values
 ('pcm.sso_propor_mapeamento_pmoc(uuid,uuid,uuid,integer,uuid,uuid,date,uuid,text)','revisao_obsoleta','P0011'),
 ('pcm.sso_decidir_proposta_pmoc(uuid,uuid,uuid,integer,text,text,text)','revisao_obsoleta','P0011'),
 ('pcm.sso_decidir_proposta_pmoc(uuid,uuid,uuid,integer,text,text,text)','plano_alterado','P0017')
 ) x(assinatura,mensagem,codigo) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);a:=format('raise exception %L using errcode=%L',r.mensagem,'40001');b:=format('raise exception %L using errcode=%L',r.mensagem,r.codigo);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'proposta_pmoc_incompativel: % %',r.assinatura,r.mensagem using errcode='55000';end if;execute replace(d,a,b);
 end loop;
end; $patch$;
