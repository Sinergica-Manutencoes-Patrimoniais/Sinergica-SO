-- ADR-1613: revisão de negócio obsoleta não é falha de serialização.
do $patch$
declare r record; d text; a text; b text;
begin
 for r in select * from (values
  ('pcm.sso_preparar_ocorrencia_por_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,text)','revisao_obsoleta'),
  ('pcm.sso_preparar_visita_canonica(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text)','revisao_ou_plano_indisponivel'),
  ('pcm.sso_preparar_lote_visita_canonica(uuid,uuid,uuid,uuid,uuid,integer,jsonb)','revisao_ou_plano_indisponivel')
 ) as t(assinatura,mensagem) loop
  d:=pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
  a:=format('raise exception %L using errcode=''40001''',r.mensagem);
  b:=format('raise exception %L using errcode=''P0016''',r.mensagem);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'preparacao_visita_incompativel: %',r.assinatura using errcode='55000'; end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
