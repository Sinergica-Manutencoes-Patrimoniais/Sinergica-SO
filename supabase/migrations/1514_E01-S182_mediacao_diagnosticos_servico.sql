-- ADR-1367: não altera ou expõe os núcleos privados nem produz faturável.
create function financeiro.sso_diagnosticar_origens_servico_mediado(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_fato_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=financeiro.sso_diagnosticar_origens_fato_servico(p_cliente_id,p_fato_id);
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_diagnosticar_origens_servico_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_diagnosticar_origens_servico_mediado(uuid,uuid) to authenticated;

create function financeiro.sso_previa_origem_servico_mediada(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_fato_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=financeiro.sso_previa_origem_servico_extra(p_cliente_id,p_fato_id);
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_previa_origem_servico_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_previa_origem_servico_mediada(uuid,uuid) to authenticated;
