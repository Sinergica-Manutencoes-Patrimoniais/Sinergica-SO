-- ADR-1619: somente guardas explícitas de negócio em feriados e mudança de dia.
do $patch$
declare r record; d text; padrao text; substituto text; n integer;
begin
 for r in select * from (values
  ('pcm.sso_decidir_feriado_declarado(uuid,uuid,uuid,integer,text,uuid,date,text,text)','revisao_obsoleta',1),
  ('pcm.sso_decidir_feriado_conferido(uuid,uuid,uuid,uuid,integer,text,integer,date)','feriado_alterado',1),
  ('pcm.sso_decidir_feriado_conferido(uuid,uuid,uuid,uuid,integer,text,integer,date)','fotografia_divergente',1),
  ('pcm.sso_registrar_supressao_semana(uuid,uuid,uuid,uuid,uuid,date,uuid,integer)','feriado_indisponivel_ou_alterado',1),
  ('pcm.sso_prever_mudanca_dia(uuid,uuid,uuid,integer,date,integer,date,uuid,integer)','revisao_obsoleta',1),
  ('pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb)','revisao_obsoleta',1),
  ('pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb)','fotografia_visitas_alterada',2),
  ('pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb)','impactos_alterados',1)
 ) as t(assinatura,mensagem,quantidade) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
  padrao:=format('raise exception %L using errcode[[:space:]]*=[[:space:]]*''40001''',r.mensagem);
  substituto:=format('raise exception %L using errcode=''P0018''',r.mensagem);
  select count(*) into n from regexp_matches(d,padrao,'g');
  if n<>r.quantidade then raise exception 'feriado_regra_incompativel: % %',r.assinatura,r.mensagem using errcode='55000'; end if;
  execute regexp_replace(d,padrao,substituto,'g');
 end loop;
end; $patch$;
