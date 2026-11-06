-- ADR-0379: somente leitura, não reabre automaticamente.
create table pcm.sso_revisao_condicao_resolvida_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_revisao_condicao_resolvida_gate(id,habilitado) values(true,false);
alter table pcm.sso_revisao_condicao_resolvida_gate enable row level security;alter table pcm.sso_revisao_condicao_resolvida_gate force row level security;
revoke all on pcm.sso_revisao_condicao_resolvida_gate from public,anon,authenticated,service_role;
create function pcm.sso_revisao_condicao_resolvida(p_pendencia_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;v_res pcm.sso_resolucao_condicao_pendencia%rowtype;v_anterior pcm.sso_contexto_pendencia%rowtype;v_atual pcm.sso_contexto_pendencia%rowtype;v_estado text;
begin
  if not coalesce((select habilitado from pcm.sso_revisao_condicao_resolvida_gate where id),false) then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_p.estado<>'resolvida' then v_estado:='nao_resolvida';
  else
    select * into v_res from pcm.sso_resolucao_condicao_pendencia where pendencia_id=p_pendencia_id order by resolucao_revision desc limit 1;
    if v_res.pendencia_id is not null then select * into v_anterior from pcm.sso_contexto_pendencia where pendencia_id=p_pendencia_id and revisao=v_res.contexto_revision; end if;
    select * into v_atual from pcm.sso_contexto_pendencia where pendencia_id=p_pendencia_id order by revisao desc limit 1;
    if v_res.pendencia_id is null or v_anterior.pendencia_id is null or v_atual.pendencia_id is null then v_estado:='indeterminada';
    elsif v_atual.condicao is distinct from v_anterior.condicao then v_estado:='condicao_alterada';
    else v_estado:='sem_alteracao'; end if;
  end if;
  return jsonb_build_object('pendenciaId',p_pendencia_id,'revision',v_p.revisao,'estado',v_estado);
end;
$$;
revoke all on function pcm.sso_revisao_condicao_resolvida(uuid) from public,anon,authenticated,service_role;
