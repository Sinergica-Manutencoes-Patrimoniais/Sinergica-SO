-- ADR-1548: consumidores usam fotografia imutável por OS antes do caminho legado.
-- Não habilita a barreira 1690 e não altera 1045.
do $migration$
declare d text; antigo text; novo text;
begin
 d:=pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure);
 antigo:=$a$  if exists (select 1 from pcm.sso_vinculos_os_grupo vg$a$;
 novo:=$b$  if exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_os.id and f.tipo='visita') then
    select f.plano_id,f.versao_id,f.rotina_id into v_ocorrencia.plano_id,v_ocorrencia.versao_id,v_ocorrencia.rotina_id
    from pcm.sso_origens_os_preventiva f where f.os_id=v_os.id and f.cliente_id=p_cliente_id and f.tipo='visita';
    if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514'; end if;
  elsif exists (select 1 from pcm.sso_vinculos_os_grupo vg$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'classificador_fotografia_incompativel' using errcode='55000'; end if;
 d:=replace(d,antigo,novo);
 antigo:=$a$  select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_ocorrencia.versao_id
    and v.plano_id=v_ocorrencia.plano_id and v.estado='aprovado';$a$;
 novo:=$b$  if exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_os.id and f.tipo='visita') then
    select f.snapshot into v_snapshot from pcm.sso_origens_os_preventiva f where f.os_id=v_os.id and f.cliente_id=p_cliente_id and f.tipo='visita' and f.versao_id=v_ocorrencia.versao_id and f.rotina_id=v_ocorrencia.rotina_id and f.plano_id=v_ocorrencia.plano_id;
    if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514'; end if;
  else
    select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_ocorrencia.versao_id and v.plano_id=v_ocorrencia.plano_id and v.estado='aprovado';
  end if;$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'classificador_snapshot_incompativel' using errcode='55000'; end if;
 execute replace(d,antigo,novo);

 d:=pg_catalog.pg_get_functiondef('pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer)'::regprocedure);
 antigo:=$a$ elsif exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_legada and vinc.cliente_id=p_cliente_id) then$a$;
 novo:=$b$ elsif exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_retorno.os_id and f.tipo='visita') then
   select f.snapshot into v_snapshot from pcm.sso_origens_os_preventiva f where f.os_id=v_retorno.os_id and f.cliente_id=p_cliente_id and f.tipo='visita' and f.versao_id=v_retorno.versao_id and f.rotina_id=v_retorno.rotina_id;
   if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514'; end if;
 elsif exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_legada and vinc.cliente_id=p_cliente_id) then$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'previa_fotografia_incompativel' using errcode='55000'; end if;
 execute replace(d,antigo,novo);

 d:=pg_catalog.pg_get_functiondef('pcm.sso_guardar_cobertura_validacao_os()'::regprocedure);
 antigo:=$a$ elsif exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_ocorrencia_legada and vinc.cliente_id=v_retorno.cliente_id) then$a$;
 novo:=$b$ elsif exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_retorno.os_id and f.tipo='visita') then
   select f.snapshot into v_snapshot from pcm.sso_origens_os_preventiva f where f.os_id=v_retorno.os_id and f.cliente_id=v_retorno.cliente_id and f.tipo='visita' and f.versao_id=v_retorno.versao_id and f.rotina_id=v_retorno.rotina_id;
   if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514'; end if;
 elsif exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_ocorrencia_legada and vinc.cliente_id=v_retorno.cliente_id) then$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'guarda_fotografia_incompativel' using errcode='55000'; end if;
 execute replace(d,antigo,novo);
end; $migration$;
-- Prévia e paginação de Visita usam a mesma fotografia da OS, mesmo sem legada.
do $migration$
declare d text; antigo text; novo text;
begin
 d:=pg_catalog.pg_get_functiondef('pcm.sso_previa_origem_visita_os(uuid,uuid)'::regprocedure);
 antigo:=$a$ if not found or v_os.ocorrencia_preventiva_id is null then raise exception 'os_indisponivel' using errcode='42501';end if;
 v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);$a$;
 novo:=$b$ if not found then raise exception 'os_indisponivel' using errcode='42501';end if;
 if exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=p_os_id) then
   select jsonb_build_object('tipo',f.tipo,'planoId',f.plano_id,'versaoId',f.versao_id,'rotinaId',f.rotina_id,
     'rotinaLogicaId',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvoId',o.alvo_id,'vencimento',o.vencimento_original,
     'preparadaId',o.id,'visitaId',o.visita_id,'serieId',o.serie_id,'semanaOrigem',o.semana_origem,
     'ocorrenciaLegadaId',v_os.ocorrencia_preventiva_id,'execucaoAutorizada',false,'aprovacaoAutorizada',false,'filaOficialAlterada',false) into v_origem
   from pcm.sso_origens_os_preventiva f join pcm.ocorrencias_visita_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
   where f.os_id=p_os_id and f.cliente_id=p_cliente_id and f.tipo='visita';
   if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
 else
   if v_os.ocorrencia_preventiva_id is null then raise exception 'os_indisponivel' using errcode='42501';end if;
   v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
 end if;$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'leitura_visita_fotografia_incompativel' using errcode='55000';end if;
 d:=replace(d,antigo,novo);
 antigo:=$a$ select * into v_versao from pcm.plano_versoes where id=(v_origem->>'versaoId')::uuid and plano_id=(v_origem->>'planoId')::uuid and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;$a$;
 novo:=$b$ if exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=p_os_id) then
   select f.snapshot into v_versao.snapshot from pcm.sso_origens_os_preventiva f where f.os_id=p_os_id and f.cliente_id=p_cliente_id and f.tipo='visita' and f.versao_id=(v_origem->>'versaoId')::uuid and f.rotina_id=(v_origem->>'rotinaId')::uuid;
 else
   select * into v_versao from pcm.plano_versoes where id=(v_origem->>'versaoId')::uuid and plano_id=(v_origem->>'planoId')::uuid and estado='aprovado';
 end if;
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'snapshot_visita_fotografia_incompativel' using errcode='55000';end if;
 execute replace(d,antigo,novo);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_perguntas_origem_visita_os(uuid,uuid,integer,integer)'::regprocedure);
 antigo:=$a$ select snapshot into v_snapshot from pcm.plano_versoes where id=(v_previa->'origem'->>'versaoId')::uuid and plano_id=(v_previa->'origem'->>'planoId')::uuid and estado='aprovado';$a$;
 novo:=$b$ if exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=p_os_id) then
   select f.snapshot into v_snapshot from pcm.sso_origens_os_preventiva f where f.os_id=p_os_id and f.cliente_id=p_cliente_id and f.tipo='visita' and f.versao_id=(v_previa->'origem'->>'versaoId')::uuid and f.rotina_id=(v_previa->'origem'->>'rotinaId')::uuid;
   if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
 else
   select snapshot into v_snapshot from pcm.plano_versoes where id=(v_previa->'origem'->>'versaoId')::uuid and plano_id=(v_previa->'origem'->>'planoId')::uuid and estado='aprovado';
 end if;$b$;
 if (length(d)-length(replace(d,antigo,'')))/length(antigo)<>1 then raise exception 'perguntas_visita_fotografia_incompativel' using errcode='55000';end if;
 execute replace(d,antigo,novo);
end; $migration$;
revoke all on function pcm.sso_previa_origem_visita_os(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_perguntas_origem_visita_os(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_cobertura_validacao_os() from public,anon,authenticated,service_role;
