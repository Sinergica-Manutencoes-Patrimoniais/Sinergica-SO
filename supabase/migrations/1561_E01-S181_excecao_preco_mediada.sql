-- ADR-1417: mediação de dados sensíveis e comando de preço excepcional.
create table comercial.sso_excecao_preco_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into comercial.sso_excecao_preco_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table comercial.sso_excecao_preco_mediada_gate enable row level security;
alter table comercial.sso_excecao_preco_mediada_gate force row level security;
revoke all on comercial.sso_excecao_preco_mediada_gate from public,anon,authenticated,service_role;

create function comercial.sso_condicoes_excecao_preco_mediada(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid)
returns table(versao integer,status text,preco_centavos bigint,piso_centavos bigint,sugerido_centavos bigint)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_proposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_excecao_preco_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_excecao_preco_gate where id and habilitado for share;
 if not found then raise exception 'excecao_indisponivel' using errcode='55000'; end if;
 if config.s184_pode_ver_custos() is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('orcamento.excecao_preco',p_cliente_id) is distinct from true
   or not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais l on l.id=o.lista_materiais_id where o.proposta_id=p_proposta_id and l.cliente_id=p_cliente_id)
   then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from comercial.sso_condicoes_excecao_preco(p_proposta_id);
end; $$;
revoke all on function comercial.sso_condicoes_excecao_preco_mediada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_condicoes_excecao_preco_mediada(uuid,uuid,uuid) to authenticated;

create function comercial.sso_excepcionar_preco_mediado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_proposta_id uuid,p_expected_revision integer,p_preco_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_proposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_excecao_preco_mediada_gate where id and escrita for share;
 if not found then raise exception 'escrita_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_excecao_preco_gate where id and habilitado for share;
 if not found then raise exception 'excecao_indisponivel' using errcode='55000'; end if;
 if config.s184_pode_ver_custos() is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('orcamento.excecao_preco',p_cliente_id) is distinct from true
   or not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais l on l.id=o.lista_materiais_id where o.proposta_id=p_proposta_id and l.cliente_id=p_cliente_id)
   then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=comercial.sso_excepcionar_preco_operacional(p_request_id,p_proposta_id,p_expected_revision,p_preco_centavos,p_motivo);
 if config.s184_pode_ver_custos() is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('orcamento.excecao_preco',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function comercial.sso_excepcionar_preco_mediado(uuid,uuid,uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_excepcionar_preco_mediado(uuid,uuid,uuid,uuid,integer,bigint,text) to authenticated;
