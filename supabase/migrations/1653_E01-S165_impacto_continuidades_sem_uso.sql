-- ADR-1510: versão anterior pode ter selo mesmo sem executar novamente o gerador.
-- Adição às consultas existentes; preserva o registro original e evita duplicações via EXISTS.
do $migracao$
declare v_item record;v_def text;v_antes text;v_depois text;v_tabela text;v_selos text;v_ref text;v_plano text;v_versao text;v_count integer;
begin
 for v_item in select * from (values
  ('pcm.sso_decidir_impacto_ocorrencia(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)','decidir_calendario'),
  ('pcm.sso_decidir_impacto_visita(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)','decidir_visita'),
  ('pcm.sso_listar_decisoes_impacto_ocorrencia(uuid,uuid,integer,uuid,integer)','calendario'),
  ('pcm.sso_listar_impactos_visita(uuid,uuid,integer,uuid,integer)','visita'),
  ('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)','calendario'),
  ('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)','visita_dupla'),
  ('pcm.sso_avaliar_fotografias_grupo_mediada(uuid,uuid,uuid,integer)','calendario'),
  ('pcm.sso_avaliar_fotografias_grupo_mediada(uuid,uuid,uuid,integer)','visita'),
  ('pcm.sso_registrar_continuidades_aprovadas()','selar_calendario'),
  ('pcm.sso_registrar_continuidades_aprovadas()','selar_visita')
 ) t(assinatura,alvo) loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  if v_item.alvo like '%calendario%' then
   v_tabela:='pcm.sso_ciclo_canonico_usos_versao';v_selos:='pcm.sso_continuidades_ciclo_aprovadas';
  else
   v_tabela:='pcm.sso_ciclo_visita_usos_versao';v_selos:='pcm.sso_continuidades_visita_aprovadas';
  end if;
  if v_item.alvo='decidir_calendario' then
   v_ref:='ocorrencias_rotina_preparadas.id';v_plano:='ocorrencias_rotina_preparadas.plano_id';v_versao:='(v_previa->>''versaoAnteriorId'')::uuid';
  elsif v_item.alvo='decidir_visita' then
   v_ref:='ocorrencias_visita_preparadas.id';v_plano:='ocorrencias_visita_preparadas.plano_id';v_versao:='(v_previa->>''versaoAnteriorId'')::uuid';
  elsif v_item.alvo like 'selar_%' then
   v_ref:='o.id';v_plano:='o.plano_id';v_versao:='new.versao_anterior_id';
  else
   v_ref:='o.id';v_plano:='o.plano_id';v_versao:='v_origem';
  end if;
  v_count:=case when v_item.alvo='visita_dupla' then 2 else 1 end;
  v_antes:='exists(select 1 from '||v_tabela||' u where u.preparada_id='||v_ref||' and u.versao_id='||v_versao||')';
  v_depois:=v_antes||' or exists(select 1 from '||v_selos||' c join pcm.plano_versoes vs on vs.id=c.versao_id and vs.plano_id=c.plano_id and vs.estado=''aprovado'' and vs.vigencia_inicio=c.vigencia where c.preparada_id='||v_ref||' and c.plano_id='||v_plano||' and c.versao_id='||v_versao||')';
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>v_count then raise exception 'definicao_impacto_incompativel: %, %',v_item.assinatura,v_item.alvo using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;

-- Bloqueia inserções de selos ao fotografar e registrar impactos na mesma transação.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_travar_fontes_impacto_grupo()'::regprocedure);
 v_antes text:='pcm.sso_ciclo_canonico_usos_versao,pcm.sso_ciclo_visita_usos_versao,';
 v_depois text:='pcm.sso_ciclo_canonico_usos_versao,pcm.sso_ciclo_visita_usos_versao,pcm.sso_continuidades_ciclo_aprovadas,pcm.sso_continuidades_visita_aprovadas,';
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_travas_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
