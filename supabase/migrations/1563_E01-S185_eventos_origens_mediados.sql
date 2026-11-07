-- ADR-1419: leitura mediada dos eventos locais, sem reexecutar integrações.
create table pcm.sso_eventos_origens_mediados_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_eventos_origens_mediados_gate(id,habilitado) values(true,false);
alter table pcm.sso_eventos_origens_mediados_gate enable row level security;
alter table pcm.sso_eventos_origens_mediados_gate force row level security;
revoke all on pcm.sso_eventos_origens_mediados_gate from public,anon,authenticated,service_role;

create function pcm.sso_eventos_comercial_mediados(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_sequencia integer,p_limite integer)
returns table(versao integer,sequencia integer,acao text,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_proposta_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_eventos_origens_mediados_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_eventos_reconciliacao_comercial(p_cliente_id,p_proposta_id,p_versao,p_sequencia,p_limite);
end; $$;
revoke all on function pcm.sso_eventos_comercial_mediados(uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_eventos_comercial_mediados(uuid,uuid,uuid,integer,integer,integer) to authenticated;

create function pcm.sso_eventos_financeiro_mediados(p_ator_id uuid,p_cliente_id uuid,p_item_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,tipo text,ocorrido_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_eventos_origens_mediados_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_eventos_reconciliacao_financeiro(p_cliente_id,p_item_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_eventos_financeiro_mediados(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_eventos_financeiro_mediados(uuid,uuid,uuid,integer,integer) to authenticated;
