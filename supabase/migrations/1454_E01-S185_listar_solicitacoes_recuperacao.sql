-- ADR-1307: histórico de solicitações locais; não executa recuperação.
create function pcm.sso_listar_solicitacoes_recuperacao(
  p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_apos uuid,p_limite integer
) returns table(request_id uuid,ator_id uuid,epoca uuid,revisao text,motivo text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
    or p_outbox_id is null or p_limite is null or p_limite not between 1 and 50 then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_solicitacao_recuperacao_gate where id and habilitado for share;
  if not found then raise exception 'solicitacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_revisao_fila_gate where id and habilitado for share;
  if not found then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  perform pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
  return query select s.request_id,s.ator_id,s.epoca,s.revisao,s.motivo,s.criado_em
    from pcm.sso_solicitacoes_recuperacao s
    where s.cliente_id=p_cliente_id and s.outbox_id=p_outbox_id
      and (p_apos is null or s.request_id>p_apos)
    order by s.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_solicitacoes_recuperacao(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_solicitacoes_recuperacao(uuid,uuid,uuid,uuid,integer) to authenticated;
