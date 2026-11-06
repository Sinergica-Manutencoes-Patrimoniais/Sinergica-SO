-- ADR-1370: mediação de comandos declaratórios; nenhum faturável é produzido.
create table financeiro.sso_comandos_servico_extra_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_comandos_servico_extra_mediado_gate(id,habilitado) values(true,false);
alter table financeiro.sso_comandos_servico_extra_mediado_gate enable row level security;
alter table financeiro.sso_comandos_servico_extra_mediado_gate force row level security;
revoke all on financeiro.sso_comandos_servico_extra_mediado_gate from public,anon,authenticated,service_role;

create function financeiro.sso_declarar_servico_extra_mediado(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer,p_linha_id uuid,p_quantidade integer,p_chave_evento text,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_comandos_servico_extra_mediado_gate where id and habilitado for share;
  if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
  perform 1 from financeiro.sso_servico_extra_gate where id and habilitado for share;
  if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
  perform 1 from financeiro.sso_coordenacao_linhas_gate where id and habilitado for share;
  if not found then raise exception 'coordenacao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_request_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=financeiro.sso_declarar_servico_extra(p_request_id,p_cliente_id,p_os_id,p_proposta_id,p_versao,p_linha_id,p_quantidade,p_chave_evento,p_justificativa);
  if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_declarar_servico_extra_mediado(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_declarar_servico_extra_mediado(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text) to authenticated;

create function financeiro.sso_decidir_servico_extra_mediado(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_comandos_servico_extra_mediado_gate where id and habilitado for share;
  if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
  perform 1 from financeiro.sso_servico_extra_gate where id and habilitado for share;
  if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
  perform 1 from financeiro.sso_coordenacao_linhas_gate where id and habilitado for share;
  if not found then raise exception 'coordenacao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_declaracao_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=financeiro.sso_decidir_servico_extra(p_request_id,p_cliente_id,p_declaracao_id,p_decisao,p_motivo);
  if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_decidir_servico_extra_mediado(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_decidir_servico_extra_mediado(uuid,uuid,uuid,text,text) to authenticated;
