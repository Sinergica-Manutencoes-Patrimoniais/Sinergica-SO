-- ADR-1495: não presumir ausentes agendamentos PMOC não vinculados no mesmo dia.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_consultar_origem_efetiva_ciclo(uuid,uuid,uuid,uuid,uuid,integer,date)'::regprocedure);
 v_antes text;v_depois text;
begin
 v_antes:='v_outros_vinculos bigint;v_validas bigint;';
 v_depois:='v_outros_vinculos bigint;v_validas bigint;v_pmoc_pendente bigint;';
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'declaracao_origem_incompativel' using errcode='55000';end if;
 v_def:=replace(v_def,v_antes,v_depois);
 v_antes:='pcm.pmoc_contracts,pcm.ocorrencias_rotina_preparadas';
 v_depois:='pcm.pmoc_contracts,pcm.sso_classificacoes_pmoc_revisao,pcm.ocorrencias_rotina_preparadas';
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'travas_origem_incompativeis' using errcode='55000';end if;
 v_def:=replace(v_def,v_antes,v_depois);
 v_antes:=$antes$ if v_outras>0 or v_outros_vinculos>0$antes$;
 v_depois:=$depois$ select count(*) into v_pmoc_pendente
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
 if v_outras>0 or v_outros_vinculos>0$depois$;
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'classificacao_origem_incompativel' using errcode='55000';end if;
 v_def:=replace(v_def,v_antes,v_depois);
 v_antes:=$antes$ elsif v_origem is null then v_estado:='origem_pendente';$antes$;
 v_depois:=$depois$ elsif v_origem='plano' and v_pmoc_pendente>0 then v_estado:='revisao_necessaria';
 elsif v_origem is null then v_estado:='origem_pendente';$depois$;
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'estado_origem_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
