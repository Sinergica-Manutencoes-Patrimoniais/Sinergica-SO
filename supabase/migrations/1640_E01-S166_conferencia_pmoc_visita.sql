-- ADR-1497: origem e inventário PMOC também no fluxo de Visita.
create function pcm.sso_exigir_pmoc_conferido_visita(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,v_logica uuid,v_tipo text,v_alvo uuid,p_vencimento date)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_pmoc_pendente bigint;
begin
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then return;end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;if not found then raise exception 'protocolo_concorrencia_indisponivel' using errcode='55000';end if;
 perform pcm.sso_guardar_ordem_ciclo(p_cliente_id);
 lock table pcm.sso_vinculos_ciclo_pmoc,pcm.sso_vinculo_pmoc_usos_versao,pcm.sso_decisoes_proposta_pmoc,pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_classificacoes_pmoc_revisao,pcm.rotina_origem_geracao in share mode nowait;
 if exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.rotina_logica_id=v_logica and v.alvo_tipo=v_tipo and v.alvo_id=v_alvo and v.vencimento=p_vencimento) then raise exception 'ciclo_pmoc_exige_reconciliacao' using errcode='23514';end if;
 select count(*) into v_pmoc_pendente
 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id
 left join lateral (select d.* from pcm.sso_classificacoes_pmoc_revisao d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.rascunho_id=p_versao_id and d.agendamento_id=s.id order by d.revisao desc limit 1) d on true
 where s.scheduled_date=p_vencimento and s.status<>'cancelado'
  and not coalesce(d.fotografia=pcm.sso_foto_inventario_pmoc(p_cliente_id,s.id) and (
   (d.classificacao='nao_relacionado' and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=s.id and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true))
   or (d.classificacao='relacionado' and exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=s.id
    and (v.versao_id=p_versao_id or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=p_versao_id))
    and (v.rotina_logica_id,v.alvo_tipo,v.alvo_id) is distinct from (v_logica,v_tipo,v_alvo)
    and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true)
    and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=s.id and (v.rotina_logica_id,v.alvo_tipo,v.alvo_id)=(v_logica,v_tipo,v_alvo)))
  ),false);
 if v_pmoc_pendente>0 then raise exception 'pmoc_mesma_data_exige_conferencia' using errcode='23514';end if;
end; $$;
revoke all on function pcm.sso_exigir_pmoc_conferido_visita(uuid,uuid,uuid,uuid,text,uuid,date) from public,anon,authenticated,service_role;
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_preparar_ocorrencia_por_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure);v_antes text;v_depois text;
begin
 v_antes:=$antes$  insert into pcm.ocorrencias_visita_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,visita_id,semana_origem,vencimento_original,fonte_dia_util_declarada,criado_por)$antes$;
 v_depois:=$depois$  perform pcm.sso_exigir_pmoc_conferido_visita(v_plano.cliente_id,p_plano_id,p_versao_id,v_logica,v_tipo,v_alvo,v_vencimento);
  insert into pcm.ocorrencias_visita_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,visita_id,semana_origem,vencimento_original,fonte_dia_util_declarada,criado_por)$depois$;
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_visita_incompativel' using errcode='55000';end if;
 v_def:=replace(v_def,v_antes,v_depois);
 v_antes:=$antes$    v_vencimento:=v_vencimento_existente;$antes$;
 v_depois:=$depois$    perform pcm.sso_exigir_pmoc_conferido_visita(v_plano.cliente_id,p_plano_id,p_versao_id,v_logica,v_tipo,v_alvo,v_vencimento_existente);
    v_vencimento:=v_vencimento_existente;$depois$;
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_reuso_visita_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
