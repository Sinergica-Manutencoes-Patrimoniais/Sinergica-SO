-- ADR-0398: projeção dos eventos existentes, sem inferir evidência.
create table pcm.sso_historico_suspensao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_suspensao_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_suspensao_gate enable row level security;alter table pcm.sso_historico_suspensao_gate force row level security;
revoke all on pcm.sso_historico_suspensao_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_historico_suspensao(p_chamado_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado text,motivo text,ator_id uuid,chamado_revision bigint,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_historico_suspensao_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_chamado_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.cliente_id into v_cliente from pcm.chamados c where c.id=p_chamado_id and c.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select e.revisao,e.estado,e.motivo,e.ator_id,e.chamado_revision,e.criado_em from pcm.sso_suspensoes_chamado_eventos e where e.chamado_id=p_chamado_id and (p_apos is null or e.revisao>p_apos) order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_historico_suspensao(uuid,integer,integer) from public,anon,authenticated,service_role;
