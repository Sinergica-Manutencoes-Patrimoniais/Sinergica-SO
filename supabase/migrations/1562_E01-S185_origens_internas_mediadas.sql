-- ADR-1418: acesso às projeções mínimas de Comercial e Financeiro.
create table pcm.sso_origens_internas_mediadas_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origens_internas_mediadas_gate(id,habilitado) values(true,false);
alter table pcm.sso_origens_internas_mediadas_gate enable row level security;
alter table pcm.sso_origens_internas_mediadas_gate force row level security;
revoke all on pcm.sso_origens_internas_mediadas_gate from public,anon,authenticated,service_role;

create function pcm.sso_reconciliacao_comercial_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(proposta_id uuid,os_id uuid,lista_id uuid,status text,versao integer,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_origens_internas_mediadas_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_reconciliacao_comercial(p_cliente_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_reconciliacao_comercial_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliacao_comercial_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_reconciliacao_financeiro_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(item_id uuid,despesa_id uuid,visita_id uuid,status text,revisao integer,despesa_revisao_atual integer,despesa_revisao_origem integer,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_origens_internas_mediadas_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_reconciliacao_financeiro(p_cliente_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_reconciliacao_financeiro_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliacao_financeiro_mediada(uuid,uuid,uuid,integer) to authenticated;
