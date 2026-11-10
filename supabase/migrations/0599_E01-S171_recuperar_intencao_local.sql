-- ADR-0373: leitura apenas das próprias intenções bloqueadas.
create function pcm.sso_listar_intencoes_locais(p_cliente_id uuid,p_visita_id uuid,p_request_id uuid default null,p_apos uuid default null)
returns table(request_id uuid,os_id uuid,revisao integer,elegivel_em timestamptz,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id)
    or not coalesce((select habilitado from pcm.intencao_local_envio_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.request_id,(c.payload->>'osId')::uuid,(c.payload->>'expectedRevision')::integer,(c.resultado->>'elegivelEm')::timestamptz,c.created_at
    from pcm.visita_comandos c where c.cliente_id=p_cliente_id and c.actor_id=auth.uid() and c.payload->>'tipo'='intencaoEnvioLocalBloqueada'
      and c.payload->>'visitaId'=p_visita_id::text and c.resultado->>'state'='bloqueada_sem_dispatch' and c.resultado->>'autorizaEnvio'='false'
      and (p_request_id is null or c.request_id=p_request_id) and (p_apos is null or c.request_id>p_apos)
    order by c.request_id limit 20;
end $$;
revoke all on function pcm.sso_listar_intencoes_locais(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
