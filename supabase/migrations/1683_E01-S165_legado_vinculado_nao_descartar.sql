-- ADR-1540: uma ponte explícita contradiz classificação não relacionada.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_fotografia_legado_nao_relacionado(uuid,uuid,uuid,integer)'::regprocedure);
 a text:=$antes$ if v_rel->>'decisao'='declarar' then raise exception 'relacao_declarada_existente' using errcode='23514';end if;$antes$;
 b text:=$depois$ if v_rel->>'decisao'='declarar' then raise exception 'relacao_declarada_existente' using errcode='23514';end if;
 if exists(select 1 from pcm.ocorrencias_preventivas l join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_legada_id=l.id join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where l.plano_id=p_legado and o.plano_id=p_plano)
  or exists(select 1 from pcm.ocorrencias_preventivas l join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=l.id join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id where l.plano_id=p_legado and o.plano_id=p_plano and v.cliente_id=p_cliente) then
  raise exception 'ponte_legada_existente' using errcode='23514';end if;$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_fotografia_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- As mesmas pontes devem permanecer estáveis em prévia, gravação e avaliação.
do $migracao$
declare s text;d text; a text:='pcm.sso_declaracoes_planos_legados in share mode nowait';b text:='pcm.sso_declaracoes_planos_legados,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado in share mode nowait';
begin
 foreach s in array array['pcm.sso_prever_legado_nao_relacionado(uuid,uuid,uuid,uuid,integer)','pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text)'] loop
  d:=pg_catalog.pg_get_functiondef(s::regprocedure);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_conferencia_incompativel: %',s using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
 d:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)'::regprocedure);
 a:='pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait';
 b:='pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado in share mode nowait';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_avaliacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
