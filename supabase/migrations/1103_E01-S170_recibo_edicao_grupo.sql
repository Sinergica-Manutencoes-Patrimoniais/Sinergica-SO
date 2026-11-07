-- ADR-0949: recibo privado; execução permanece revogada até revisão.
create table config.sso_edicoes_grupo(
  request_id uuid primary key,
  grupo_id uuid not null references config.grupos(id),
  ator_id uuid not null references auth.users(id),
  payload jsonb not null,
  criado_em timestamptz not null default now()
);
alter table config.sso_edicoes_grupo enable row level security;
alter table config.sso_edicoes_grupo force row level security;
revoke all on config.sso_edicoes_grupo from public,anon,authenticated,service_role;
create function config.sso_edicoes_grupo_imutaveis() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function config.sso_edicoes_grupo_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_edicoes_grupo_imutaveis before update or delete on config.sso_edicoes_grupo
  for each row execute function config.sso_edicoes_grupo_imutaveis();

create function config.sso_editar_grupo_idempotente(p_request_id uuid,p_id uuid,p_patch jsonb,p_permissoes jsonb,p_estado_esperado jsonb,p_ator_esperado uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_payload jsonb;v_anterior config.sso_edicoes_grupo%rowtype;
begin
  if v_ator is null or p_ator_esperado is distinct from v_ator or p_request_id is null or p_id is null then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  if coalesce(auth.jwt()->>'user_role','') not in ('superadmin','supervisor')
    or not exists(select 1 from config.usuarios u where u.user_id=v_ator and u.ativo and u.papel in ('superadmin','supervisor')) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  v_payload:=jsonb_build_object('patch',p_patch,'permissoes',p_permissoes,'estadoEsperado',p_estado_esperado);
  select * into v_anterior from config.sso_edicoes_grupo where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.grupo_id is distinct from p_id or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505';
    end if;
    return;
  end if;
  perform config.sso_editar_grupo_atomico(p_id,p_patch,p_permissoes,p_estado_esperado,p_ator_esperado);
  insert into config.sso_edicoes_grupo(request_id,grupo_id,ator_id,payload) values(p_request_id,p_id,v_ator,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload)
    values(v_ator,'grupo.editado','grupos',p_id,jsonb_build_object('requestId',p_request_id));
end; $$;
revoke all on function config.sso_editar_grupo_idempotente(uuid,uuid,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
