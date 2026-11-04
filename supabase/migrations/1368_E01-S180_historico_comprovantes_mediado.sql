-- ADR-1213: histórico por Cliente e Visita, sem expor caminhos dos objetos.
create function pcm.sso_historico_realizacao_despesa_mediado(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid,p_apos integer)
returns table(revisao integer,valor_centavos bigint,ator_id uuid,registrado_em timestamptz,tipo text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_visita_id is null or p_despesa_id is null or p_apos is null or p_apos < 0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_resumo_despesa_gate where id and habilitado for share;
  if not found then raise exception 'historico_indisponivel' using errcode='55000'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id for share;
  if not found then raise exception 'despesa_indisponivel' using errcode='42501'; end if;
  return query select * from pcm.sso_historico_realizacao_despesa(p_despesa_id,p_apos);
end; $$;
revoke all on function pcm.sso_historico_realizacao_despesa_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_realizacao_despesa_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;
