-- ADR-1415: entradas autenticadas para correção lógica e leitura de alocações.
create table financeiro.sso_correcao_faturavel_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into financeiro.sso_correcao_faturavel_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table financeiro.sso_correcao_faturavel_mediada_gate enable row level security;
alter table financeiro.sso_correcao_faturavel_mediada_gate force row level security;
revoke all on financeiro.sso_correcao_faturavel_mediada_gate from public,anon,authenticated,service_role;

create function financeiro.sso_listar_alocacoes_mediada(p_ator_id uuid,p_cliente_id uuid,p_item_id uuid,p_apos uuid)
returns table(id uuid,documento_ref text,valor_centavos bigint,estornada boolean,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_correcao_faturavel_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from financeiro.sso_listar_alocacoes_faturavel(p_item_id,p_apos);
end; $$;
revoke all on function financeiro.sso_listar_alocacoes_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_listar_alocacoes_mediada(uuid,uuid,uuid,uuid) to authenticated;

create function financeiro.sso_estornar_alocacao_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_estorno_id uuid,p_item_id uuid,p_expected_revision integer,p_alocacao_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_correcao_faturavel_mediada_gate where id and escrita for share;
 if not found then raise exception 'correcao_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_faturamento_gate where id and habilitado for share;
 if not found then raise exception 'faturamento_indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=financeiro.sso_estornar_alocacao(p_request_id,p_estorno_id,p_item_id,p_expected_revision,p_alocacao_id,p_motivo);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_estornar_alocacao_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_estornar_alocacao_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;

create function financeiro.sso_complementar_faturavel_mediado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_item_base_id uuid,p_expected_revision integer,p_item_id uuid,p_complemento_id uuid,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_base_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_correcao_faturavel_mediada_gate where id and escrita for share;
 if not found then raise exception 'correcao_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_faturamento_gate where id and habilitado for share;
 if not found then raise exception 'faturamento_indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_base_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=financeiro.sso_complementar_faturavel(p_request_id,p_item_base_id,p_expected_revision,p_item_id,p_complemento_id,p_valor_centavos,p_motivo);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_complementar_faturavel_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_complementar_faturavel_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text) to authenticated;
