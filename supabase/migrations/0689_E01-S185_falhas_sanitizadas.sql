-- ADR-0463: observação mínima do estado atual, sem acesso a payload ou mensagem bruta.
create function pcm.sso_diagnostico_falha_fila(p_cliente_id uuid,p_outbox_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q pcm.auvo_sync_outbox%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_outbox_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into q from pcm.auvo_sync_outbox where id=p_outbox_id;
  if not found or not ((q.entity='sistemas' and exists(select 1 from pcm.sistemas where id=q.row_id and cliente_id=p_cliente_id))
    or (q.entity='equipamentos' and exists(select 1 from pcm.equipamentos where id=q.row_id and client_id=p_cliente_id))) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('outboxId',q.id,'estadoFila',q.status,'tentativas',q.attempts,
    'falhaRegistrada',q.status='error','detalheInternoExistente',q.last_error is not null,
    'classificacao',case when q.status='error' then 'falha_sem_detalhes' when q.status='processing' then 'processando_resultado_incerto' when q.status='pending' then 'pendente' else 'enviado_nao_confirmado' end,
    'estadoRemoto','desconhecido','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_diagnostico_falha_fila(uuid,uuid) from public,anon,authenticated,service_role;
