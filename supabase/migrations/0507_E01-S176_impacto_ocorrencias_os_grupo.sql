-- ADR-0281: contagens rastreáveis e incompletas; execução privada.
create table pcm.sso_impacto_execucao_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impacto_execucao_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_impacto_execucao_grupo_gate enable row level security;
alter table pcm.sso_impacto_execucao_grupo_gate force row level security;
revoke all on pcm.sso_impacto_execucao_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_impacto_execucao_grupo(p_grupo_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_ocorrencias bigint;v_os bigint;
begin
  if not coalesce((select habilitado from pcm.sso_impacto_execucao_grupo_gate where id),false) then raise exception 'impacto_execucao_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.ativo and g.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true or config.sso_autorizar_acao('plano.gerir',v_cliente) is not true or config.sso_autorizar_acao('execucao.validar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into v_ocorrencias from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id where p.cliente_id=v_cliente and o.alvo_tipo='grupo' and o.alvo_id=p_grupo_id;
  select count(distinct t.os_id) into v_os from pcm.sso_pendencias_tecnicas t where t.cliente_id=v_cliente and t.alvo_tipo='grupo' and t.alvo_id=p_grupo_id;
  return jsonb_build_object('grupoId',p_grupo_id,'ocorrenciasPreparadas',v_ocorrencias,'osReferenciadasPorPendencia',v_os);
end;
$$;
revoke all on function pcm.sso_impacto_execucao_grupo(uuid) from public,anon,authenticated,service_role;
