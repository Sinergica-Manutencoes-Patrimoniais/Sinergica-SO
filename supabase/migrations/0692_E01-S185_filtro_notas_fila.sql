-- ADR-0466: filtros sobre fatos persistidos, não inventar revisão da fila.
create function pcm.sso_listar_notas_fila_filtradas(p_cliente_id uuid,p_outbox_id uuid,p_ator uuid,p_estado text,p_tentativas integer,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,observacao text,status_observado text,tentativas_observadas integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_outbox_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.auvo_sync_outbox o where o.id=p_outbox_id and (
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null)<>(p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos))
    or (p_estado is not null and p_estado not in ('pending','processing','sent','error')) or (p_tentativas is not null and p_tentativas<0) then raise exception 'filtro_invalido' using errcode='22023'; end if;
  return query select n.request_id,n.actor_id,n.observacao,n.status_observado,n.tentativas_observadas,n.created_at from pcm.reconciliacao_outbox_notas n
    where n.cliente_id=p_cliente_id and n.outbox_id=p_outbox_id and (p_ator is null or n.actor_id=p_ator)
      and (p_estado is null or n.status_observado=p_estado) and (p_tentativas is null or n.tentativas_observadas=p_tentativas)
      and (p_apos is null or (n.created_at,n.request_id)>(p_apos,p_apos_id)) order by n.created_at,n.request_id limit p_limite;
end $$;
revoke all on function pcm.sso_listar_notas_fila_filtradas(uuid,uuid,uuid,text,integer,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
