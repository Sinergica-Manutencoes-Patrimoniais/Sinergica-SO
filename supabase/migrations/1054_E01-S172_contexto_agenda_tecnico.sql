-- ADR-0867: leitura sem efeitos operacionais e sem alterar políticas existentes.
create table pcm.capacidade_agenda_tecnico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.capacidade_agenda_tecnico_gate enable row level security;
alter table pcm.capacidade_agenda_tecnico_gate force row level security;
revoke all on pcm.capacidade_agenda_tecnico_gate from public,anon,authenticated,service_role;
insert into pcm.capacidade_agenda_tecnico_gate(id,habilitado) values(true,false);

create function pcm.sso_agenda_tecnico_capacidade_habilitada() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select habilitado from pcm.capacidade_agenda_tecnico_gate where id),false);
$$;
revoke all on function pcm.sso_agenda_tecnico_capacidade_habilitada() from public,anon,service_role;
grant execute on function pcm.sso_agenda_tecnico_capacidade_habilitada() to authenticated;

create function pcm.sso_listar_agenda_tecnico_capacidade(p_cliente_id uuid,p_semana_inicio date,p_apos_data date default null,p_apos_id uuid default null,p_limite integer default 50)
returns table(id uuid,funcionario_id uuid,data date,hora_inicio time,hora_fim time)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not pcm.sso_agenda_tecnico_capacidade_habilitada() then raise exception 'agenda_capacidade_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100 or ((p_apos_data is null)<>(p_apos_id is null)) or (p_apos_data is not null and (p_apos_data<p_semana_inicio or p_apos_data>=p_semana_inicio+7)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select a.id,a.funcionario_id,a.data,a.hora_inicio,a.hora_fim from pcm.agenda_tecnico a
 where a.cliente_id=p_cliente_id and a.deleted_at is null and a.data>=p_semana_inicio and a.data<p_semana_inicio+7
   and (p_apos_data is null or (a.data,a.id)>(p_apos_data,p_apos_id)) order by a.data,a.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_agenda_tecnico_capacidade(uuid,date,date,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_listar_agenda_tecnico_capacidade(uuid,date,date,uuid,integer) to authenticated;
