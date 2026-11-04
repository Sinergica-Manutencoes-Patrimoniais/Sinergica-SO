-- ADR-1116: diagnóstico, sem movimentação ou supressão.
create table pcm.sso_previa_impedimentos_dia_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_previa_impedimentos_dia_gate(id,habilitado) values(true,false);
alter table pcm.sso_previa_impedimentos_dia_gate enable row level security;
alter table pcm.sso_previa_impedimentos_dia_gate force row level security;
revoke all on pcm.sso_previa_impedimentos_dia_gate from public,anon,authenticated,service_role;

create function pcm.sso_prever_impedimentos_mudanca_dia(p_ator_id uuid,p_cliente_id uuid,p_serie_id uuid,p_expected_revision integer,
 p_vigencia date,p_dia_semana integer,p_apos_semana date,p_apos_id uuid,p_limite integer)
returns table(visita_id uuid,semana_origem date,regra_origem_id uuid,inicio_em timestamptz,estado text,revisao integer,
 data_proposta date,classificacao text,feriado_declarado boolean,ocorrencia_preparada boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v_contrato uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_serie_id is null then
  raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
  raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_previa_impedimentos_dia_gate where id and habilitado for share;
 if not found then raise exception 'previa_impedimentos_desabilitada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then
  raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 select s.contrato_id into v_contrato from pcm.calendario_contratual_series s where s.id=p_serie_id and s.cliente_id=p_cliente_id for share;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 return query select p.visita_id,p.semana_origem,p.regra_origem_id,p.inicio_em,p.estado,p.revisao,p.data_proposta,p.classificacao,
  exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo and f.data=p.data_proposta
   and (f.contrato_id is null or f.contrato_id=v_contrato)),
  exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.visita_id=p.visita_id and o.serie_id=p_serie_id)
  from pcm.sso_prever_mudanca_dia(p_ator_id,p_cliente_id,p_serie_id,p_expected_revision,p_vigencia,p_dia_semana,p_apos_semana,p_apos_id,p_limite) p;
end; $$;
revoke all on function pcm.sso_prever_impedimentos_mudanca_dia(uuid,uuid,uuid,integer,date,integer,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_impedimentos_mudanca_dia(uuid,uuid,uuid,integer,date,integer,date,uuid,integer) to authenticated;
