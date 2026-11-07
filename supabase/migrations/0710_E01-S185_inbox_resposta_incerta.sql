-- ADR-0484: projeção local, sem criar ocorrência nem chamar integração.
create function pcm.sso_inbox_os_situacao_incerta(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,estado_local text,vinculo_local boolean,declaracao text,declarada_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select o.id,o.numero::text,o.auvo_sync_status::text,o.auvo_task_id is not null,ultima.resultado_declarado,ultima.criado_em
    from pcm.ordens_servico o left join lateral (
      select e.resultado_declarado,e.criado_em from pcm.reconciliacao_os_notas n join pcm.reconciliacao_os_evidencias_manuais e on e.request_id=n.request_id
      where n.os_id=o.id and n.cliente_id=p_cliente_id order by e.criado_em desc,e.request_id desc limit 1
    ) ultima on true where o.client_id=p_cliente_id and o.deleted_at is null and (o.auvo_sync_status is not null or o.auvo_task_id is not null)
      and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end $$;
revoke all on function pcm.sso_inbox_os_situacao_incerta(uuid,uuid,integer) from public,anon,authenticated,service_role;
