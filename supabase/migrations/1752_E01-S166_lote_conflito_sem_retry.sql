-- ADR-1610: conflitos explícitos do lote de calendário são erros de negócio.
do $patch$
declare r record; d text; a text; b text;
begin
 for r in select * from (values
  ('pcm.sso_origens_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)','revisao_obsoleta'),
  ('pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)','revisao_obsoleta'),
  ('pcm.sso_materializar_lote_calendario_conferido(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb)','previa_divergente')
 ) as t(assinatura,mensagem) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
  a:=format('raise exception %L using errcode=''40001''',r.mensagem);
  b:=format('raise exception %L using errcode=''P0015''',r.mensagem);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'lote_calendario_incompativel: %',r.assinatura using errcode='55000'; end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
