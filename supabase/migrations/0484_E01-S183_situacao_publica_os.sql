-- ADR-0258: projeção conservadora; retorno PCM não é conclusão global da OS.
create table pcm.portal_situacao_os_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.portal_situacao_os_gate(id,habilitado) values(true,false);
alter table pcm.portal_situacao_os_gate enable row level security;
alter table pcm.portal_situacao_os_gate force row level security;
revoke all on pcm.portal_situacao_os_gate from public,anon,authenticated,service_role;
create function pcm.sso_portal_situacao_os(p_cliente_id uuid,p_os_id uuid)
returns table(estado text, aprovacao_retorno_registrada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
      where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null)
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.portal_situacao_os_gate where id),false) then raise exception 'situacao_indisponivel' using errcode='55000'; end if;
  return query select case when o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','finalizado','cancelado')
      then o.status::text else 'desconhecido' end,
    exists(select 1 from pcm.retorno_os_preparado r join pcm.decisoes_validacao_os d on d.retorno_id=r.id
      where r.os_id=o.id and r.cliente_id=o.client_id and d.decisao='aprovar')
    from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null;
end $$;
revoke all on function pcm.sso_portal_situacao_os(uuid,uuid) from public,anon,authenticated,service_role;
