-- ADR-1373: leitura e escrita separadas; nenhum faturável é criado.
create table comercial.sso_classificacao_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into comercial.sso_classificacao_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table comercial.sso_classificacao_mediada_gate enable row level security;
alter table comercial.sso_classificacao_mediada_gate force row level security;
revoke all on comercial.sso_classificacao_mediada_gate from public,anon,authenticated,service_role;

create function comercial.sso_listar_classificacao_linhas_mediada(p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_apos uuid,p_limite integer)
returns table(linha_id uuid,descricao text,classificacao_id uuid,tipo text,autor_id uuid,decisao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_classificacao_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_classificacao_linha_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or p_versao is null or p_limite is null or p_limite not between 1 and 100
   or (config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true and config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select x.* from comercial.sso_listar_classificacao_linhas(p_cliente_id,p_proposta_id,p_versao,p_apos,p_limite) x;
end; $$;
revoke all on function comercial.sso_listar_classificacao_linhas_mediada(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_listar_classificacao_linhas_mediada(uuid,uuid,integer,uuid,integer) to authenticated;

create function comercial.sso_declarar_classificacao_linha_mediada(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_linha_id uuid,p_tipo text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_classificacao_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from comercial.sso_classificacao_linha_gate where id and habilitado for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=comercial.sso_declarar_classificacao_linha(p_request_id,p_cliente_id,p_proposta_id,p_versao,p_linha_id,p_tipo,p_motivo);
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function comercial.sso_declarar_classificacao_linha_mediada(uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_declarar_classificacao_linha_mediada(uuid,uuid,uuid,integer,uuid,text,text) to authenticated;

create function comercial.sso_revisar_classificacao_linha_mediada(p_request_id uuid,p_cliente_id uuid,p_classificacao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_classificacao_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from comercial.sso_classificacao_linha_gate where id and habilitado for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=comercial.sso_revisar_classificacao_linha(p_request_id,p_cliente_id,p_classificacao_id,p_decisao,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function comercial.sso_revisar_classificacao_linha_mediada(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_revisar_classificacao_linha_mediada(uuid,uuid,uuid,text,text) to authenticated;
