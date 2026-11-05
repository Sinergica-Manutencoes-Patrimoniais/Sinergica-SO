-- ADR-1549: os mesmos consumidores usam a fotografia para calendário e Visita.
do $migracao$
declare s text;d text;a text:=$antes$f.tipo='visita'$antes$;b text:=$depois$f.tipo in ('visita','calendario')$depois$;n integer;esperado integer;
begin
 for s,esperado in select * from (values
  ('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)',4),
  ('pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer)',2),
  ('pcm.sso_guardar_cobertura_validacao_os()',2)
 ) x(assinatura,total) loop
  d:=pg_catalog.pg_get_functiondef(s::regprocedure);
  n:=(length(d)-length(replace(d,a,'')))/length(a);
  if n<>esperado then raise exception 'consumidor_fotografia_incompativel: %',s using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $migracao$;
