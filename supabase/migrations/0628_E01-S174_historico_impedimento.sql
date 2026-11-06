-- ADR-0402: consulta mínima de impedimento para evento existente.
create table pcm.sso_historico_impedimento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_impedimento_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_impedimento_gate enable row level security;alter table pcm.sso_historico_impedimento_gate force row level security;
revoke all on pcm.sso_historico_impedimento_gate from public,anon,authenticated,service_role;
create function pcm.sso_consultar_impedimento_suspensao(p_chamado_id uuid,p_revision integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_impedimento text;
begin
  if not coalesce((select habilitado from pcm.sso_historico_impedimento_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_chamado_id is null or p_revision is null or p_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.cliente_id into v_cliente from pcm.chamados c where c.id=p_chamado_id and c.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.sso_suspensoes_chamado_eventos e where e.chamado_id=p_chamado_id and e.revisao=p_revision) then raise exception 'evento_indisponivel' using errcode='23514'; end if;
  select i.impedimento into v_impedimento from pcm.sso_impedimentos_suspensao i where i.chamado_id=p_chamado_id and i.revisao=p_revision;
  return jsonb_build_object('chamadoId',p_chamado_id,'revision',p_revision,'impedimento',v_impedimento);
end;
$$;
revoke all on function pcm.sso_consultar_impedimento_suspensao(uuid,integer) from public,anon,authenticated,service_role;
