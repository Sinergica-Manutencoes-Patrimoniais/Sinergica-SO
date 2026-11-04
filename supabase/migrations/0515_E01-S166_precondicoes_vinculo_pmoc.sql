-- ADR-0289: sem evidência de alvo não há vínculo nem deduplicação.
create function pcm.sso_verificar_vinculo_ciclo_pmoc(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_vencimento date,p_agendamento_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_data date;v_existe_ciclo boolean;
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) then raise exception 'diagnostico_pmoc_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_vencimento is null or not isfinite(p_vencimento) or p_agendamento_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select s.scheduled_date into v_data from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null
 join pcm.pmoc_contracts k on k.id=s.contract_id and k.property_id=p.id and k.deleted_at is null where s.id=p_agendamento_id and s.status<>'cancelado';
 if not found then raise exception 'agendamento_indisponivel' using errcode='23514'; end if;
 select exists(select 1 from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento) c where c.vencimento=p_vencimento) into v_existe_ciclo;
 return jsonb_build_object('cicloPrevisto',v_existe_ciclo,'mesmaData',v_data=p_vencimento,'mesmoCliente',true,'contratoOrigemValido',true,
  'alvoComprovado',false,'contratoEquivalenteComprovado',false,'vinculoDisponivel',false,'motivo','ausente_fonte_verificavel_de_alvo_e_equivalencia_contratual');
end; $$;
revoke all on function pcm.sso_verificar_vinculo_ciclo_pmoc(uuid,uuid,uuid,uuid,date,uuid) from public,anon,authenticated,service_role;
