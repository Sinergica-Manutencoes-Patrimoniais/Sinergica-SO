-- ADR-1052: leitura privada de histórico mínimo por Cliente e outbox.
create function pcm.sso_listar_observacoes_fila(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_apos_revision integer,p_limite integer)
returns table(revisao integer,request_id uuid,ator_id uuid,estado text,estado_fonte text,tentativas integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_outbox pcm.auvo_sync_outbox%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_outbox_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_apos_revision is not null and p_apos_revision<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_outbox from pcm.auvo_sync_outbox where id=p_outbox_id for share;
  if not found or v_outbox.entity not in ('sistemas','equipamentos') then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  if v_outbox.entity='sistemas' then
    perform 1 from pcm.sistemas where id=v_outbox.row_id and cliente_id=p_cliente_id for share;
  else
    perform 1 from pcm.equipamentos where id=v_outbox.row_id and client_id=p_cliente_id for share;
  end if;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  return query select e.revisao,e.request_id,e.ator_id,e.estado,e.estado_fonte,e.tentativas,e.criado_em
    from pcm.sso_ocorrencias_fila_eventos e join pcm.sso_ocorrencias_fila o on o.outbox_id=e.outbox_id
    where e.outbox_id=p_outbox_id and o.cliente_id=p_cliente_id and o.entidade=v_outbox.entity and o.objeto_id=v_outbox.row_id
      and (p_apos_revision is null or e.revisao>p_apos_revision) order by e.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_observacoes_fila(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
