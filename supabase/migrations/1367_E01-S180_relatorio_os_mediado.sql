-- ADR-1212: entrada interna para consulta privada, sem efeito financeiro.
create function pcm.sso_relatorio_despesas_os_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_inicio date,p_fim date)
returns table(despesas bigint,previsto_nao_realizado_centavos numeric,realizado_centavos numeric,sem_realizado bigint,vinculos_historicos bigint)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_os_id is null or p_inicio is null or p_fim is null
    or not pg_catalog.isfinite(p_inicio) or not pg_catalog.isfinite(p_fim) or p_inicio > p_fim or p_fim-p_inicio > 730 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_resumo_despesa_gate where id and habilitado for share;
  if not found then raise exception 'relatorio_indisponivel' using errcode='55000'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'ordem_indisponivel' using errcode='42501'; end if;
  return query select * from pcm.sso_relatorio_despesas_os(p_cliente_id,p_os_id,p_inicio,p_fim);
end; $$;
revoke all on function pcm.sso_relatorio_despesas_os_mediado(uuid,uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_relatorio_despesas_os_mediado(uuid,uuid,uuid,date,date) to authenticated;
