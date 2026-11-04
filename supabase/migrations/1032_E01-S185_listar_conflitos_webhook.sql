-- ADR-0844: consulta privada, gate e ACL de reconciliação permanecem fechados.
create function pcm.sso_listar_conflitos_webhook_chamado(
 p_cliente_id uuid,p_os_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer
) returns table(id uuid,task_id text,status_remoto text,criado_em timestamptz,resolvido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.reconciliacao_outbox_gate g where g.id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
   or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then
   raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null) <> (p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then
   raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select x.id,x.auvo_task_id::text,x.status_remoto,x.criado_em,x.resolvido_em
   from pcm.reconciliacao_webhook_chamado_conflitos x where x.cliente_id=p_cliente_id and x.os_id=p_os_id
     and (p_apos is null or (x.criado_em,x.id)>(p_apos,p_apos_id))
   order by x.criado_em,x.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_conflitos_webhook_chamado(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
