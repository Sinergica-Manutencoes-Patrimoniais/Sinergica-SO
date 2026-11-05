-- ADR-1499: nova OS PMOC não contorna ocorrência de Plano já preparada.
create function pcm.sso_guardar_os_pmoc_ocorrencia_plano() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_data date;v_foto jsonb;v_oc record;v_versao uuid;v_total integer;v_class pcm.sso_classificacoes_pmoc_revisao%rowtype;v_resolvido boolean;
begin
 if new.pmoc_schedule_id is null then return new;end if;
 if tg_op='UPDATE' and (new.pmoc_schedule_id,new.client_id) is not distinct from (old.pmoc_schedule_id,old.client_id) then return new;end if;
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then return new;end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;if not found then raise exception 'protocolo_concorrencia_indisponivel' using errcode='55000';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03';end if;
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_vinculos_ciclo_pmoc,pcm.sso_vinculo_pmoc_usos_versao,pcm.sso_decisoes_proposta_pmoc,pcm.sso_classificacoes_pmoc_revisao,pcm.rotina_origem_geracao,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,pcm.plano_versoes in share mode nowait;
 select s.scheduled_date into v_data from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=new.client_id where s.id=new.pmoc_schedule_id;
 if not found then raise exception 'agendamento_pmoc_indisponivel' using errcode='23514';end if;
 v_foto:=pcm.sso_foto_inventario_pmoc(new.client_id,new.pmoc_schedule_id);
 for v_oc in
  select distinct o.plano_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id from (
   select x.plano_id,x.rotina_logica_id,x.alvo_tipo,x.alvo_id,x.vencimento_original from pcm.ocorrencias_rotina_preparadas x
   union all select x.plano_id,x.rotina_logica_id,x.alvo_tipo,x.alvo_id,x.vencimento_original from pcm.ocorrencias_visita_preparadas x
  ) o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=new.client_id where o.vencimento_original=v_data
 loop
  select count(*),min(v.id::text)::uuid into v_total,v_versao from pcm.plano_versoes v where v.plano_id=v_oc.plano_id and v.estado='aprovado' and v.vigencia_inicio<=v_data and (v.vigencia_fim is null or v.vigencia_fim>=v_data);
  if v_total<>1 then raise exception 'pmoc_plano_exige_conferencia' using errcode='23514';end if;
  select d.* into v_class from pcm.sso_classificacoes_pmoc_revisao d where d.cliente_id=new.client_id and d.plano_id=v_oc.plano_id and d.rascunho_id=v_versao and d.agendamento_id=new.pmoc_schedule_id order by d.revisao desc limit 1;
  v_resolvido:=found and v_class.fotografia is not distinct from v_foto and (
   (v_class.classificacao='nao_relacionado' and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=new.client_id and v.plano_id=v_oc.plano_id and v.agendamento_id=new.pmoc_schedule_id and pcm.sso_foto_pmoc_valida(new.client_id,v.id,pcm.sso_foto_impacto_pmoc(new.client_id,v.id)) is true))
   or (v_class.classificacao='relacionado' and exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=new.client_id and v.plano_id=v_oc.plano_id and v.agendamento_id=new.pmoc_schedule_id
    and (v.versao_id=v_versao or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_versao))
    and (v.rotina_logica_id,v.alvo_tipo,v.alvo_id) is distinct from (v_oc.rotina_logica_id,v_oc.alvo_tipo,v_oc.alvo_id) and pcm.sso_foto_pmoc_valida(new.client_id,v.id,pcm.sso_foto_impacto_pmoc(new.client_id,v.id)) is true)
    and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=new.client_id and v.plano_id=v_oc.plano_id and v.agendamento_id=new.pmoc_schedule_id and (v.rotina_logica_id,v.alvo_tipo,v.alvo_id)=(v_oc.rotina_logica_id,v_oc.alvo_tipo,v_oc.alvo_id)))
  );
  if v_resolvido is distinct from true then raise exception 'pmoc_plano_exige_conferencia' using errcode='23514';end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_os_pmoc_ocorrencia_plano() from public,anon,authenticated,service_role;
create trigger sso_guardar_os_pmoc_ocorrencia_plano before insert or update of pmoc_schedule_id,client_id on pcm.ordens_servico for each row execute function pcm.sso_guardar_os_pmoc_ocorrencia_plano();
