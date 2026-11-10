-- ADR-1624: divergências de negócio não são serialização transitória.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_ciclo_pmoc(uuid,uuid,uuid,uuid,integer,boolean,boolean,text,text)'::regprocedure);
 m text; a text; b text;
begin
 foreach m in array array['plano_alterado','decisao_nao_validada_ou_obsoleta'] loop
  a:=format('raise exception %L using errcode=%L',m,'40001');
  b:=format('raise exception %L using errcode=%L',m,'P0019');
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'vinculo_pmoc_incompativel: %',m using errcode='55000';end if;
  d:=replace(d,a,b);
 end loop;
 execute d;
end; $patch$;
