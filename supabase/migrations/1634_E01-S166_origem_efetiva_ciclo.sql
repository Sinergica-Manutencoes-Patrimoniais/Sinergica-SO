-- ADR-1491: consulta de origem para ciclo revisionado, sem escrita operacional.
create function pcm.sso_consultar_origem_efetiva_ciclo(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_vencimento date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_contexto jsonb;v_logica uuid;v_tipo text;v_alvo uuid;v_origem text;v_ciclo integer;v_preparadas bigint;v_outras bigint;v_todas bigint;v_outros_vinculos bigint;v_validas bigint;v_vinculo pcm.sso_vinculos_ciclo_pmoc%rowtype;v_estado text;v_agendamento uuid;
begin
 if p_vencimento is null or not isfinite(p_vencimento) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 v_contexto:=pcm.sso_contexto_origem_rotina(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision);
 v_logica:=(v_contexto->>'rotinaLogicaId')::uuid;v_tipo:=v_contexto->>'alvoTipo';v_alvo:=(v_contexto->>'alvoId')::uuid;v_origem:=v_contexto->>'origem';
 select c.ciclo into v_ciclo from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento) c where c.vencimento=p_vencimento;
 if v_ciclo is null then raise exception 'vencimento_nao_e_ciclo' using errcode='23514'; end if;
 lock table pcm.sso_vinculos_ciclo_pmoc,pcm.sso_vinculo_pmoc_usos_versao,pcm.sso_decisoes_proposta_pmoc,pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas in share mode nowait;
 select (select count(*) from pcm.ocorrencias_rotina_preparadas o where o.rotina_logica_id=v_logica and o.alvo_tipo=v_tipo and o.alvo_id=v_alvo and o.vencimento_original=p_vencimento)
       +(select count(*) from pcm.ocorrencias_visita_preparadas o where o.rotina_logica_id=v_logica and o.alvo_tipo=v_tipo and o.alvo_id=v_alvo and o.vencimento_original=p_vencimento) into v_preparadas;
 select (select count(*) from pcm.ocorrencias_rotina_preparadas o where o.plano_id<>p_plano_id and o.rotina_logica_id=v_logica and o.alvo_tipo=v_tipo and o.alvo_id=v_alvo and o.vencimento_original=p_vencimento)
       +(select count(*) from pcm.ocorrencias_visita_preparadas o where o.plano_id<>p_plano_id and o.rotina_logica_id=v_logica and o.alvo_tipo=v_tipo and o.alvo_id=v_alvo and o.vencimento_original=p_vencimento) into v_outras;
 select count(*) into v_todas from pcm.sso_vinculos_ciclo_pmoc v where v.rotina_logica_id=v_logica and v.alvo_tipo=v_tipo and v.alvo_id=v_alvo and v.vencimento=p_vencimento;
 select count(*) into v_outros_vinculos from pcm.sso_vinculos_ciclo_pmoc v where v.rotina_logica_id=v_logica and v.alvo_tipo=v_tipo and v.alvo_id=v_alvo and v.vencimento=p_vencimento and (v.cliente_id<>p_cliente_id or v.plano_id<>p_plano_id);
 select count(*) into v_validas from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.rotina_logica_id=v_logica and v.alvo_tipo=v_tipo and v.alvo_id=v_alvo and v.vencimento=p_vencimento
  and (v.versao_id=p_versao_id or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=p_versao_id)) and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true;
 if v_validas=1 then
  select v.* into v_vinculo from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.rotina_logica_id=v_logica and v.alvo_tipo=v_tipo and v.alvo_id=v_alvo and v.vencimento=p_vencimento
   and (v.versao_id=p_versao_id or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=p_versao_id)) and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true;
  v_agendamento:=v_vinculo.agendamento_id;
 end if;
 if v_outras>0 or v_outros_vinculos>0 or v_preparadas>1 or v_validas>1 or (v_preparadas>0 and v_todas>0) or (v_origem='plano' and v_todas>0) then v_estado:='conflito';
 elsif v_origem is null then v_estado:='origem_pendente';
 elsif v_origem='pmoc' and v_preparadas>0 then v_estado:='conflito';
 elsif v_origem='pmoc' and v_validas=1 then v_estado:='pmoc_vinculado';
 elsif v_origem='pmoc' and v_todas>0 then v_estado:='revisao_necessaria';
 elsif v_origem='pmoc' then v_estado:='pmoc_pendente';
 else v_estado:='plano';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'revisao',p_expected_revision,'ciclo',v_ciclo,'vencimento',p_vencimento,'estado',v_estado,'agendamentoId',case when v_estado='pmoc_vinculado' then v_agendamento else null end,'fontesCompletas',false,'exclusividadeGlobalComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_origem_efetiva_ciclo(uuid,uuid,uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_origem_efetiva_ciclo(uuid,uuid,uuid,uuid,uuid,integer,date) to authenticated;
