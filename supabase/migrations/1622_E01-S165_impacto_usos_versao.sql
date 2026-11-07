-- ADR-1479: a versão de uso também integra o universo de revisão.
create index sso_uso_calendario_versao_preparada_idx on pcm.sso_ciclo_canonico_usos_versao(versao_id,preparada_id);
create index sso_uso_visita_versao_preparada_idx on pcm.sso_ciclo_visita_usos_versao(versao_id,preparada_id);

do $migracao$
declare v_item record;v_def text;v_antes text;v_depois text;v_count integer;
begin
 for v_item in select * from (values
 ('pcm.sso_decidir_impacto_ocorrencia(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)', 'decidir_calendario'),
 ('pcm.sso_decidir_impacto_visita(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)', 'decidir_visita'),
 ('pcm.sso_listar_decisoes_impacto_ocorrencia(uuid,uuid,integer,uuid,integer)', 'listar_calendario'),
 ('pcm.sso_listar_impactos_visita(uuid,uuid,integer,uuid,integer)', 'listar_visita'),
 ('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)', 'avaliar_calendario'),
 ('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)', 'avaliar_visita'),
 ('pcm.sso_avaliar_fotografias_grupo_mediada(uuid,uuid,uuid,integer)', 'avaliar_grupo'),
 ('pcm.sso_registrar_continuidades_aprovadas()', 'selar')
 ) t(assinatura,alvo)
 loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  if v_item.alvo like 'decidir_%' then
   v_antes:=$antes$and versao_id=(v_previa->>'versaoAnteriorId')::uuid for update;$antes$;
   if v_item.alvo='decidir_calendario' then
    v_depois:=$depois$and (versao_id=(v_previa->>'versaoAnteriorId')::uuid or exists(select 1 from pcm.sso_ciclo_canonico_usos_versao u where u.preparada_id=ocorrencias_rotina_preparadas.id and u.versao_id=(v_previa->>'versaoAnteriorId')::uuid)) for update;$depois$;
   else
    v_depois:=$depois$and (versao_id=(v_previa->>'versaoAnteriorId')::uuid or exists(select 1 from pcm.sso_ciclo_visita_usos_versao u where u.preparada_id=ocorrencias_visita_preparadas.id and u.versao_id=(v_previa->>'versaoAnteriorId')::uuid)) for update;$depois$;
   end if;
   v_count:=1;
  elsif v_item.alvo in ('listar_calendario','avaliar_calendario') then
   v_antes:='o.versao_id=v_origem';
   v_depois:='(o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_canonico_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem))';v_count:=1;
  elsif v_item.alvo in ('listar_visita','avaliar_visita') then
   v_antes:='o.versao_id=v_origem';
   v_depois:='(o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_visita_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem))';
   v_count:=case when v_item.alvo='avaliar_visita' then 2 else 1 end;
  elsif v_item.alvo='avaliar_grupo' then
   v_antes:=$antes$from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem$antes$;
   v_depois:=$depois$from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano_id and (o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_canonico_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem))$depois$;
   if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_impacto_incompativel: %',v_item.assinatura using errcode='55000'; end if;
   v_def:=replace(v_def,v_antes,v_depois);
   v_antes:=$antes$from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem$antes$;
   v_depois:=$depois$from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and (o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_visita_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem))$depois$;v_count:=1;
  else
   -- Delimitadores diferentes impedem misturar os dois modos.
   v_antes:=$antes$where o.plano_id=new.plano_id and o.versao_id=new.versao_anterior_id and o.vencimento_original>=new.vigencia_inicio$antes$;
   v_depois:=$depois$where o.plano_id=new.plano_id and (o.versao_id=new.versao_anterior_id or exists(select 1 from pcm.sso_ciclo_canonico_usos_versao u where u.preparada_id=o.id and u.versao_id=new.versao_anterior_id)) and o.vencimento_original>=new.vigencia_inicio$depois$;
   if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_impacto_incompativel: %',v_item.assinatura using errcode='55000'; end if;
   v_def:=replace(v_def,v_antes,v_depois);
   v_antes:=$antes$where o.plano_id=new.plano_id and o.versao_id=new.versao_anterior_id
   and d.decisao='manter_sem_alterar'$antes$;
   v_depois:=$depois$where o.plano_id=new.plano_id and (o.versao_id=new.versao_anterior_id or exists(select 1 from pcm.sso_ciclo_visita_usos_versao u where u.preparada_id=o.id and u.versao_id=new.versao_anterior_id))
   and d.decisao='manter_sem_alterar'$depois$;v_count:=1;
  end if;
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>v_count then raise exception 'definicao_impacto_incompativel: %',v_item.assinatura using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;

-- A leitura de usos precisa proteger também inserções concorrentes nessas tabelas.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_travar_fontes_impacto_grupo()'::regprocedure);
 v_antes text:='pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,';
 v_depois text:='pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,pcm.sso_ciclo_canonico_usos_versao,pcm.sso_ciclo_visita_usos_versao,';
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_travas_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
