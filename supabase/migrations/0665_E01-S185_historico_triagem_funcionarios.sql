-- ADR-0439: leitura da triagem por Visita, sem mutar fila.
create function pcm.sso_sync_funcionarios_visita(p_cliente_id uuid,p_visita_id uuid,p_apos uuid,p_limite integer)
returns table(outbox_id uuid,funcionario_id uuid,estado text,tentativas integer,enfileirado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_funcionario_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select q.id,q.row_id,q.status,q.attempts,q.enqueued_at from pcm.auvo_sync_outbox q
    where q.entity='funcionarios' and q.status in ('pending','processing','error') and (p_apos is null or q.id>p_apos)
      and exists(select 1 from pcm.visita_equipes ve where ve.visita_id=p_visita_id and ve.cliente_id=p_cliente_id and ve.funcionario_id=q.row_id and ve.encerrado_em is null)
      order by q.id limit p_limite;
end $$;
revoke all on function pcm.sso_sync_funcionarios_visita(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_historico_sync_funcionario_visita(p_cliente_id uuid,p_visita_id uuid,p_outbox_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(request_id uuid,observacao text,estado text,tentativas integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_funcionario_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' or p_cliente_id is null or p_visita_id is null or p_outbox_id is null
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or not exists(
      select 1 from pcm.auvo_sync_outbox q join pcm.visita_equipes ve on ve.funcionario_id=q.row_id
      join pcm.visitas v on v.id=ve.visita_id and v.cliente_id=ve.cliente_id
      where q.id=p_outbox_id and q.entity='funcionarios' and ve.visita_id=p_visita_id and ve.cliente_id=p_cliente_id and ve.encerrado_em is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null)<>(p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select n.request_id,n.observacao,n.status_observado,n.tentativas_observadas,n.created_at from pcm.reconciliacao_outbox_notas n
    where n.cliente_id=p_cliente_id and n.outbox_id=p_outbox_id and (p_apos is null or (n.created_at,n.request_id)>(p_apos,p_apos_id)) order by n.created_at,n.request_id limit p_limite;
end $$;
revoke all on function pcm.sso_historico_sync_funcionario_visita(uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
