-- ADR-0429: leitura autorizada e paginada de declarações não verificadas.
create function pcm.sso_listar_evidencias_os_manual(p_cliente_id uuid,p_os_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(request_id uuid,resultado_declarado text,origem text,referencia text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false)
    or not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null)<>(p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.request_id,e.resultado_declarado,e.origem,e.referencia,e.criado_em
    from pcm.reconciliacao_os_evidencias_manuais e join pcm.reconciliacao_os_notas n on n.request_id=e.request_id
    where n.cliente_id=p_cliente_id and n.os_id=p_os_id and (p_apos is null or (e.criado_em,e.request_id)>(p_apos,p_apos_id))
    order by e.criado_em,e.request_id limit p_limite;
end $$;
revoke all on function pcm.sso_listar_evidencias_os_manual(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
