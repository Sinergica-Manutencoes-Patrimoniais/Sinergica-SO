-- ADR-1049: filtro antes da paginação, preservando RLS nativa.
create table pcm.sso_filtro_tecnico_agenda_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_filtro_tecnico_agenda_gate(id,habilitado) values(true,false);
alter table pcm.sso_filtro_tecnico_agenda_gate enable row level security;
alter table pcm.sso_filtro_tecnico_agenda_gate force row level security;
revoke all on pcm.sso_filtro_tecnico_agenda_gate from public,anon,authenticated,service_role;

-- Helper não devolve dados e impede concessão direta à tabela privada.
create function pcm.sso_exigir_filtro_tecnico_agenda() returns void language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_agenda_tecnico_capacidade();
  perform 1 from pcm.sso_filtro_tecnico_agenda_gate where id and habilitado for share;
  if not found then raise exception 'filtro_tecnico_desabilitado' using errcode='55000'; end if;
end; $$;
revoke all on function pcm.sso_exigir_filtro_tecnico_agenda() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_exigir_filtro_tecnico_agenda() to authenticated;

create function pcm.sso_listar_agenda_tecnico_filtrada(p_cliente_id uuid,p_semana_inicio date,p_funcionario_id uuid,p_apos_data date,p_apos_id uuid,p_limite integer)
returns table(id uuid,funcionario_id uuid,data date,hora_inicio time,hora_fim time)
language plpgsql volatile security invoker set search_path='' as $$
begin
  perform pcm.sso_exigir_filtro_tecnico_agenda();
  if auth.uid() is null or p_cliente_id is null or p_funcionario_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100
    or ((p_apos_data is null)<>(p_apos_id is null)) or (p_apos_data is not null and (p_apos_data<p_semana_inicio or p_apos_data>=p_semana_inicio+7)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
  return query select a.id,a.funcionario_id,a.data,a.hora_inicio,a.hora_fim from pcm.agenda_tecnico a
    where a.cliente_id=p_cliente_id and a.funcionario_id=p_funcionario_id and a.deleted_at is null and a.data>=p_semana_inicio and a.data<p_semana_inicio+7
      and (p_apos_data is null or (a.data,a.id)>(p_apos_data,p_apos_id)) order by a.data,a.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_agenda_tecnico_filtrada(uuid,date,uuid,date,uuid,integer) from public,anon,authenticated,service_role;
