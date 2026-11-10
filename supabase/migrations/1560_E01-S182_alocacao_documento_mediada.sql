-- ADR-1416: documento existente; não cria lançamento ou cobrança.
create table financeiro.sso_alocacao_documento_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_alocacao_documento_mediada_gate(id,habilitado) values(true,false);
alter table financeiro.sso_alocacao_documento_mediada_gate enable row level security;
alter table financeiro.sso_alocacao_documento_mediada_gate force row level security;
revoke all on financeiro.sso_alocacao_documento_mediada_gate from public,anon,authenticated,service_role;
create function financeiro.sso_alocar_documento_mediado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_alocacao_id uuid,
 p_item_id uuid,p_expected_revision integer,p_lancamento_id uuid,p_documento_ref text,p_data_documento date,p_valor_centavos bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_id is null or p_lancamento_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_alocacao_documento_mediada_gate where id and habilitado for share;
 if not found then raise exception 'alocacao_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_faturamento_gate where id and habilitado for share;
 if not found then raise exception 'faturamento_indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id and i.origem_tipo<>'servico_extra_fato')
   or not exists(select 1 from financeiro.lancamentos l where l.id=p_lancamento_id and l.cliente_id=p_cliente_id and l.tipo='entrada') then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- A repetição do mesmo comando confirmado deve retornar o recibo proprietário,
 -- mesmo se uma reserva posterior exigir conciliação para novas alocações.
 if p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:' || p_request_id::text, 0));
 if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then
   return financeiro.sso_alocar_faturavel_documento(p_request_id,p_alocacao_id,p_item_id,p_expected_revision,p_lancamento_id,p_documento_ref,p_data_documento,p_valor_centavos);
 end if;
 -- Reserva histórica não pode ser ignorada mesmo se o gate da origem estiver fechado.
 lock table financeiro.sso_documentos_internos in share mode nowait;
 if exists(select 1 from financeiro.sso_documentos_internos d where d.item_id=p_item_id) then raise exception 'reserva_exige_conciliacao' using errcode='23514'; end if;
 v_resultado:=financeiro.sso_alocar_faturavel_documento(p_request_id,p_alocacao_id,p_item_id,p_expected_revision,p_lancamento_id,p_documento_ref,p_data_documento,p_valor_centavos);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_alocar_documento_mediado(uuid,uuid,uuid,uuid,uuid,integer,uuid,text,date,bigint) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_alocar_documento_mediado(uuid,uuid,uuid,uuid,uuid,integer,uuid,text,date,bigint) to authenticated;
