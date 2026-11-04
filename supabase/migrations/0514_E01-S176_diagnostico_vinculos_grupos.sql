-- ADR-0288: leitura agregada, privada e desativada.
create table pcm.sso_diagnostico_grupos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_grupos_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_grupos_gate enable row level security;
alter table pcm.sso_diagnostico_grupos_gate force row level security;
revoke all on pcm.sso_diagnostico_grupos_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnostico_vinculos_grupos(p_cliente_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total bigint;v_local bigint;v_sistema bigint;
begin
  if not coalesce((select habilitado from pcm.sso_diagnostico_grupos_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*),count(*) filter(where l.id is null or not l.ativo or l.deleted_at is not null or a.id is null or not a.ativo or a.deleted_at is not null),
    count(*) filter(where g.sistema_id is not null and (s.id is null or not s.ativo or s.deleted_at is not null))
    into v_total,v_local,v_sistema from pcm.grupos_quantitativos g
    left join pcm.locais l on l.id=g.local_id left join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente_id
    left join pcm.sistemas s on s.id=g.sistema_id and s.cliente_id=p_cliente_id
    where g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null;
  return jsonb_build_object('clienteId',p_cliente_id,'totalGrupos',v_total,'localOuAreaIndisponivel',v_local,'sistemaIndisponivel',v_sistema);
end;
$$;
revoke all on function pcm.sso_diagnostico_vinculos_grupos(uuid) from public,anon,authenticated,service_role;
