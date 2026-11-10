-- ADR-1622: guardas de revisão explícitas, mantendo replay e autorização.
do $patch$
declare r record; d text; padrao text; substituto text; n integer;
begin
 for r in select * from (values
  ('pcm.sso_criar_regra_contratual(uuid,integer,uuid,uuid,uuid,date,integer,integer,time,integer,integer,text,date,date)','revisao_obsoleta'),
  ('pcm.sso_alterar_dia_contratual(uuid,uuid,uuid,integer,integer,date)','revisao_obsoleta'),
  ('pcm.sso_decidir_feriado_calendario(uuid,uuid,uuid,uuid,integer,text)','revisao_obsoleta')
 ) as t(assinatura,mensagem) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
  padrao:=format('raise exception %L using errcode[[:space:]]*=[[:space:]]*''40001''',r.mensagem);
  substituto:=format('raise exception %L using errcode=''P0018''',r.mensagem);
  select count(*) into n from regexp_matches(d,padrao,'g');
  if n<>1 then raise exception 'regra_feriado_incompativel: %',r.assinatura using errcode='55000'; end if;
  execute regexp_replace(d,padrao,substituto,'g');
 end loop;
end; $patch$;
