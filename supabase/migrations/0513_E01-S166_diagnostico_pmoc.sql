-- ADR-0287: concomitância por data, não confirmação de duplicidade.
create table pcm.sso_diagnostico_pmoc_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_diagnostico_pmoc_gate enable row level security;
alter table pcm.sso_diagnostico_pmoc_gate force row level security;
revoke all on pcm.sso_diagnostico_pmoc_gate from public,anon,authenticated,service_role;
insert into pcm.sso_diagnostico_pmoc_gate(id,habilitado) values(true,false);

create function pcm.sso_diagnosticar_concomitancia_pmoc(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_inicio date,p_fim date,p_apos integer,p_limite integer)
returns table(ciclo integer,vencimento date,agendamentos_pmoc_mesma_data bigint,diagnostico text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) then raise exception 'diagnostico_pmoc_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.ciclo,c.vencimento,(select count(*) from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts k on k.id=s.contract_id and k.property_id=p.id and k.deleted_at is null where s.scheduled_date=c.vencimento and s.status<>'cancelado'),
  'alvo_nao_correlacionado_conflito_indeterminado'::text
 from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim) c where p_apos is null or c.ciclo>p_apos order by c.ciclo limit p_limite;
end; $$;
revoke all on function pcm.sso_diagnosticar_concomitancia_pmoc(uuid,uuid,uuid,uuid,date,date,integer,integer) from public,anon,authenticated,service_role;
