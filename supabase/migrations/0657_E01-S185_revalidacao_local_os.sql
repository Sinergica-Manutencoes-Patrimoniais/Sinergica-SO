-- ADR-0431: somente leitura; nenhum retry, consulta ou alteração remota.
create function pcm.sso_revalidar_incerteza_os_local(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; n pcm.reconciliacao_os_notas%rowtype; e pcm.reconciliacao_os_evidencias_manuais%rowtype; situacao text;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false)
    or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select nota.* into n from pcm.reconciliacao_os_notas nota join pcm.reconciliacao_os_evidencias_manuais evid on evid.request_id=nota.request_id
    where nota.cliente_id=p_cliente_id and nota.os_id=p_os_id order by evid.criado_em desc,evid.request_id desc limit 1;
  if n.request_id is null then situacao:='sem_declaracao';
  else
    select * into e from pcm.reconciliacao_os_evidencias_manuais where request_id=n.request_id;
    situacao:=case when n.versao_observada is distinct from coalesce(o.updated_at,o.created_at) or n.sync_observado is distinct from o.auvo_sync_status
      or n.task_observada is distinct from o.auvo_task_id::text then 'fonte_local_alterada' else 'fonte_local_equivalente' end;
  end if;
  return jsonb_build_object('osId',o.id,'versaoLocal',coalesce(o.updated_at,o.created_at),'estadoLocal',o.auvo_sync_status,
    'tarefaLocal',o.auvo_task_id::text,'situacaoLocal',situacao,'ultimaDeclaracao',case when n.request_id is null then null else
      jsonb_build_object('requestId',n.request_id,'resultadoDeclarado',e.resultado_declarado,'declaradaEm',e.criado_em) end,
    'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_revalidar_incerteza_os_local(uuid,uuid) from public,anon,authenticated,service_role;
