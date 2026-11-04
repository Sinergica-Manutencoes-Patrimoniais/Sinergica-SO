-- ADR-0237: projeção mínima de estados existentes, sem dados pessoais nem custos.
create table pcm.sso_portal_timeline_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.sso_portal_timeline_gate enable row level security;
alter table pcm.sso_portal_timeline_gate force row level security;
revoke all on pcm.sso_portal_timeline_gate from public, anon, authenticated, service_role;
insert into pcm.sso_portal_timeline_gate(id, habilitado) values (true, false);

create function pcm.sso_portal_timeline_os(p_cliente_id uuid, p_os_id uuid,
  p_antes_data timestamptz default null, p_antes_id uuid default null)
returns table(id uuid, status text, ocorrido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null
    or ((p_antes_data is null) <> (p_antes_id is null)) then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from pcm.sso_portal_timeline_gate g where g.id), false) then
    raise exception 'timeline_indisponivel' using errcode = '55000'; end if;
  return query select e.id, e.status_novo, e.created_at from pcm.os_status_eventos e
    where e.ordem_servico_id = p_os_id and e.status_novo in ('solicitacao', 'corretiva', 'backlog', 'planejamento', 'em_execucao', 'finalizado', 'cancelado')
      and (p_antes_data is null or (e.created_at, e.id) < (p_antes_data, p_antes_id))
    order by e.created_at desc, e.id desc limit 20;
end;
$$;
revoke all on function pcm.sso_portal_timeline_os(uuid, uuid, timestamptz, uuid) from public, anon, authenticated, service_role;
