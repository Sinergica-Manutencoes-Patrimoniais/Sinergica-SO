-- ADR-0279: somente leitura, preparação fechada.
create table pcm.sso_impacto_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impacto_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_impacto_grupo_gate enable row level security;
alter table pcm.sso_impacto_grupo_gate force row level security;
revoke all on pcm.sso_impacto_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_impacto_rotinas_grupo(p_grupo_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_total bigint;
begin
  if not coalesce((select habilitado from pcm.sso_impacto_grupo_gate where id),false) then raise exception 'impacto_grupo_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.ativo and g.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true or config.sso_autorizar_acao('plano.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into v_total from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id join pcm.planos_manutencao p on p.id=r.plano_id
    where r.alvo_tipo='grupo' and r.grupo_id=p_grupo_id and p.cliente_id=v_cliente and v.estado='aprovado' and v.vigencia_inicio<=current_date and (v.vigencia_fim is null or v.vigencia_fim>=current_date);
  return jsonb_build_object('grupoId',p_grupo_id,'rotinasDiretasVigentes',v_total);
end;
$$;
revoke all on function pcm.sso_impacto_rotinas_grupo(uuid) from public,anon,authenticated,service_role;
