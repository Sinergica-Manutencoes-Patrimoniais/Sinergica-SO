-- ADR-0446: estados persistidos, sem inferir sucesso ou enviar.
create function pcm.sso_listar_outbox_reconciliacao_filtrada(p_cliente_id uuid,p_estado text,p_apos uuid,p_limite integer)
returns table(id uuid,entidade text,objeto_id uuid,operacao text,estado text,estado_fonte text,tentativas integer,enfileirado_em timestamptz,enviado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_estado is not null and p_estado not in ('pending','processing','error','sent')) then raise exception 'filtro_invalido' using errcode='22023'; end if;
  return query select o.id,o.entity,o.row_id,o.op,case o.status when 'pending' then 'pendente' when 'processing' then 'incerto' when 'error' then 'incerto' else 'enviado_nao_confirmado' end,
    o.status,o.attempts,o.enqueued_at,o.sent_at from pcm.auvo_sync_outbox o
    where (p_estado is null or o.status=p_estado) and (p_apos is null or o.id>p_apos) and (
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))
    order by o.id limit p_limite;
end $$;
revoke all on function pcm.sso_listar_outbox_reconciliacao_filtrada(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
