-- ADR-0475: comparação de contexto observado, não uma revisão monotônica.
create function pcm.sso_revalidar_previa_fila(p_cliente_id uuid,p_outbox_id uuid,p_estado text,p_tentativas integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q pcm.auvo_sync_outbox%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_outbox_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_estado is null or p_estado not in ('pending','processing','sent','error') or p_tentativas is null or p_tentativas<0 then raise exception 'previa_invalida' using errcode='22023'; end if;
  select * into q from pcm.auvo_sync_outbox where id=p_outbox_id;
  if not found or not ((q.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=q.row_id and s.cliente_id=p_cliente_id))
    or (q.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=q.row_id and e.client_id=p_cliente_id))) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('outboxId',q.id,'contextoEquivalente',q.status=p_estado and q.attempts=p_tentativas,
    'revisaoMonotonicaDisponivel',false,'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_revalidar_previa_fila(uuid,uuid,text,integer) from public,anon,authenticated,service_role;
