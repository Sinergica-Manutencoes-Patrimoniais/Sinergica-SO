-- ADR-1489: proteção de identidade explicitamente vinculada e leitura sem criar obrigações.
create index sso_vinculos_pmoc_plano_consulta_idx on pcm.sso_vinculos_ciclo_pmoc(cliente_id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,vencimento,criado_em desc,id desc);
create function pcm.sso_guardar_ocorrencia_pmoc_vinculada() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.rotina_logica_id,new.alvo_tipo,new.alvo_id,new.vencimento_original) is not distinct from (old.rotina_logica_id,old.alvo_tipo,old.alvo_id,old.vencimento_original) then return new; end if;
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;
 if not found then return new; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-identidade-pmoc:'||new.rotina_logica_id::text||':'||new.alvo_tipo||':'||new.alvo_id::text||':'||new.vencimento_original::text,0)) then raise exception 'identidade_em_alteracao' using errcode='55P03'; end if;
 if exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.rotina_logica_id=new.rotina_logica_id and v.alvo_tipo=new.alvo_tipo and v.alvo_id=new.alvo_id and v.vencimento=new.vencimento_original) then raise exception 'ciclo_pmoc_exige_reconciliacao' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_ocorrencia_pmoc_vinculada() from public,anon,authenticated,service_role;
create trigger sso_guardar_calendario_pmoc before insert or update of rotina_logica_id,alvo_tipo,alvo_id,vencimento_original on pcm.ocorrencias_rotina_preparadas for each row execute function pcm.sso_guardar_ocorrencia_pmoc_vinculada();
create trigger sso_guardar_visita_pmoc before insert or update of rotina_logica_id,alvo_tipo,alvo_id,vencimento_original on pcm.ocorrencias_visita_preparadas for each row execute function pcm.sso_guardar_ocorrencia_pmoc_vinculada();

create function pcm.sso_listar_obrigacoes_pmoc_plano(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_apos uuid,p_limite integer)
returns table(vinculo_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento date,agendamento_id uuid,status_pmoc text,estado_vinculo text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if p_plano_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query with vinculos as (
  select v.*,s.status status_atual,
   (s.id is not null and s.contract_id=v.contrato_pmoc_id and s.scheduled_date=v.vencimento and s.status<>'cancelado' and pr.client_id=p_cliente_id and pr.deleted_at is null and c.id is not null and c.deleted_at is null
    and exists(select 1 from pcm.sso_decisoes_proposta_pmoc d where d.id=v.decisao_id and d.decisao='validada_pcm' and d.revisao=(select max(d2.revisao) from pcm.sso_decisoes_proposta_pmoc d2 where d2.proposta_id=v.proposta_id))) atual
  from pcm.sso_vinculos_ciclo_pmoc v left join pcm.pmoc_schedules s on s.id=v.agendamento_id
  left join pcm.pmoc_properties pr on pr.id=s.property_id left join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=pr.id
  where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id
 ), classificados as (
  select v.*,row_number() over(partition by v.rotina_logica_id,v.alvo_tipo,v.alvo_id,v.vencimento order by v.criado_em desc,v.id desc) ordem,
   count(*) filter(where v.atual) over(partition by v.rotina_logica_id,v.alvo_tipo,v.alvo_id,v.vencimento) ativos from vinculos v
 ) select x.id,x.versao_id,x.rotina_id,x.alvo_tipo,x.alvo_id,x.vencimento,x.agendamento_id,x.status_atual,
  case when x.ativos>1 then 'conflito' when not coalesce(x.atual,false) then 'revisao_necessaria' else 'declarado_pcm' end
 from classificados x where x.ordem=1 and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_obrigacoes_pmoc_plano(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_obrigacoes_pmoc_plano(uuid,uuid,uuid,uuid,integer) to authenticated;
