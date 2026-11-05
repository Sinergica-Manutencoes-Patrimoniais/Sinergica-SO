-- ADR-1487: mediação de diagnóstico e decisão, sem deduplicação automática.
create table pcm.sso_pmoc_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_pmoc_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_pmoc_mediado_gate enable row level security;
alter table pcm.sso_pmoc_mediado_gate force row level security;
revoke all on pcm.sso_pmoc_mediado_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_pmoc_mediado(p_ator uuid,p_cliente uuid,p_decisao boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_decisao is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_pmoc_mediado_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_diagnostico_pmoc_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if p_decisao then perform 1 from pcm.sso_decisao_pmoc_gate where id and habilitado for share; if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or (p_decisao and config.sso_autorizar_acao('cadastro.aprovar',p_cliente) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_pmoc_mediado(uuid,uuid,boolean) from public,anon,authenticated,service_role;
create function pcm.sso_diagnosticar_pmoc_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_inicio date,p_fim date,p_apos integer,p_limite integer)
returns table(ciclo integer,vencimento date,agendamentos_pmoc_mesma_data bigint,diagnostico text) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false); return query select * from pcm.sso_diagnosticar_concomitancia_pmoc(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim,p_apos,p_limite); if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; end; $$;
revoke all on function pcm.sso_diagnosticar_pmoc_mediado(uuid,uuid,uuid,uuid,uuid,date,date,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_pmoc_mediado(uuid,uuid,uuid,uuid,uuid,date,date,integer,integer) to authenticated;
create function pcm.sso_candidatos_pmoc_mediados(p_ator_id uuid,p_cliente_id uuid,p_data date,p_apos uuid,p_limite integer)
returns table(id uuid,scheduled_date date,maintenance_type text,status text) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false); return query select * from pcm.sso_listar_agendamentos_pmoc_candidatos(p_cliente_id,p_data,p_apos,p_limite); if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; end; $$;
revoke all on function pcm.sso_candidatos_pmoc_mediados(uuid,uuid,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_candidatos_pmoc_mediados(uuid,uuid,date,uuid,integer) to authenticated;
create function pcm.sso_propostas_pmoc_mediadas(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rotina_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,versao_id uuid,vencimento date,agendamento_pmoc_id uuid,alvo_tipo text,alvo_id uuid,revisao_plano integer,justificativa text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false); return query select * from pcm.sso_listar_propostas_mapeamento_pmoc(p_cliente_id,p_plano_id,p_rotina_id,p_apos,p_limite); if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; end; $$;
revoke all on function pcm.sso_propostas_pmoc_mediadas(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_propostas_pmoc_mediadas(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
create function pcm.sso_propor_pmoc_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_versao_id uuid,p_rotina_id uuid,p_vencimento date,p_agendamento_id uuid,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 if p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 if not exists(select 1 from pcm.sso_propostas_mapeamento_pmoc where request_id=p_request_id) then
  perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update nowait;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts k on k.id=s.contract_id and k.property_id=p.id and k.deleted_at is null where s.id=p_agendamento_id and s.scheduled_date=p_vencimento and s.status<>'cancelado' for share of s nowait;
  if not found then raise exception 'agendamento_ou_data_indisponivel' using errcode='23514'; end if;
 end if;
 r:=pcm.sso_propor_mapeamento_pmoc(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_versao_id,p_rotina_id,p_vencimento,p_agendamento_id,p_justificativa);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; return r;end; $$;
revoke all on function pcm.sso_propor_pmoc_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,date,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_propor_pmoc_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,date,uuid,text) to authenticated;
create function pcm.sso_decisoes_pmoc_mediadas(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,decisao text,evidencia_referencia text,justificativa text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true); return query select * from pcm.sso_listar_decisoes_proposta_pmoc(p_cliente_id,p_proposta_id,p_antes,p_limite); if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; end; $$;
revoke all on function pcm.sso_decisoes_pmoc_mediadas(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisoes_pmoc_mediadas(uuid,uuid,uuid,integer,integer) to authenticated;
create function pcm.sso_decidir_pmoc_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_expected_revision integer,p_decisao text,p_evidencia_referencia text,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb; v_proposta pcm.sso_propostas_mapeamento_pmoc%rowtype;begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true);
 if p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 if not exists(select 1 from pcm.sso_decisoes_proposta_pmoc where request_id=p_request_id) then
  select * into v_proposta from pcm.sso_propostas_mapeamento_pmoc where id=p_proposta_id and cliente_id=p_cliente_id for update nowait;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.planos_manutencao where id=v_proposta.plano_id and cliente_id=p_cliente_id for share nowait;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts k on k.id=s.contract_id and k.property_id=p.id and k.deleted_at is null where s.id=v_proposta.agendamento_pmoc_id and s.scheduled_date=v_proposta.vencimento and s.status<>'cancelado' for share of s nowait;
  if not found then raise exception 'agendamento_ou_data_indisponivel' using errcode='23514'; end if;
 end if;
 r:=pcm.sso_decidir_proposta_pmoc(p_request_id,p_cliente_id,p_proposta_id,p_expected_revision,p_decisao,p_evidencia_referencia,p_justificativa);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if; return r;end; $$;
revoke all on function pcm.sso_decidir_pmoc_mediado(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_pmoc_mediado(uuid,uuid,uuid,uuid,integer,text,text,text) to authenticated;
