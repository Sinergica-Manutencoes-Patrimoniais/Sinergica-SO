-- ADR-0459: metadado de presença local, sem prova de autenticidade remota.
create function pcm.sso_diagnostico_snapshot_os(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; quantidade integer; ultima timestamptz;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*)::integer,max(last_webhook_received_at) into quantidade,ultima from pcm.auvo_task_snapshots s
    where s.ordem_servico_id=o.id and o.auvo_task_id is not null and s.auvo_task_id=o.auvo_task_id;
  return jsonb_build_object('osId',o.id,'snapshotLocalEncontrado',quantidade>0,'ultimaRecepcaoDeclarada',ultima,
    'autenticidade','nao_comprovada','situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_diagnostico_snapshot_os(uuid,uuid) from public,anon,authenticated,service_role;
