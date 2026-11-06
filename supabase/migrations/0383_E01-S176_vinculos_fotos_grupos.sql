-- ADR-0157: somente estrutura privada, não cria bucket nem concede execução.
create table pcm.sso_grupo_fotos_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_grupo_fotos_gate(id,habilitado) values(true,false);
alter table pcm.sso_grupo_fotos_gate enable row level security;
alter table pcm.sso_grupo_fotos_gate force row level security;
revoke all on pcm.sso_grupo_fotos_gate from public,anon,authenticated,service_role;

create table pcm.sso_grupo_fotos (
  id uuid primary key default gen_random_uuid(), grupo_id uuid not null references pcm.grupos_quantitativos(id),
  cliente_id uuid not null references pcm.clientes(id), objeto_id uuid not null unique,
  criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(),
  unique(grupo_id,objeto_id)
);
create table pcm.sso_grupo_fotos_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_grupo_fotos enable row level security;
alter table pcm.sso_grupo_fotos force row level security;
alter table pcm.sso_grupo_fotos_comandos enable row level security;
alter table pcm.sso_grupo_fotos_comandos force row level security;
revoke all on pcm.sso_grupo_fotos,pcm.sso_grupo_fotos_comandos from public,anon,authenticated,service_role;

create function pcm.sso_vincular_foto_grupo(p_request_id uuid,p_grupo_id uuid,p_objeto_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid:=auth.uid(); v_grupo pcm.grupos_quantitativos%rowtype; v_cmd pcm.sso_grupo_fotos_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_grupo_fotos_gate where id),false) then raise exception 'fotos_grupo_desabilitadas' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_grupo_id is null or p_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('grupoId',p_grupo_id,'objetoId',p_objeto_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('grupo-foto:' || p_request_id::text,0));
  select * into v_cmd from pcm.sso_grupo_fotos_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('cadastro.gerir',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  select * into v_grupo from pcm.grupos_quantitativos where id=p_grupo_id for update;
  if not found or not v_grupo.ativo or v_grupo.deleted_at is not null or config.sso_autorizar_acao('cadastro.gerir',v_grupo.cliente_id) is not true then raise exception 'grupo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id
    where o.id=p_objeto_id and o.bucket_id='sso-grupos-fotos' and b.public is false and o.owner_id=v_ator::text
      and o.name like (v_grupo.cliente_id::text || '/' || v_grupo.id::text || '/%')) then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_grupo_fotos(grupo_id,cliente_id,objeto_id,criado_por) values(p_grupo_id,v_grupo.cliente_id,p_objeto_id,v_ator) returning id into v_id;
  v_resultado:=jsonb_build_object('fotoId',v_id,'grupoId',p_grupo_id,'requestId',p_request_id);
  insert into pcm.sso_grupo_fotos_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_grupo.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'grupo.foto_vinculada','grupos_quantitativos',p_grupo_id,
    jsonb_build_object('fotoId',v_id,'requestId',p_request_id,'clienteId',v_grupo.cliente_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_foto_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_grupo(p_grupo_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_grupo_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select cliente_id into v_cliente from pcm.grupos_quantitativos where id=p_grupo_id;
  if not found or not (config.sso_autorizar_acao('cadastro.ler',v_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select f.id,f.criado_em from pcm.sso_grupo_fotos f where f.grupo_id=p_grupo_id and f.cliente_id=v_cliente and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_fotos_grupo(uuid,uuid,integer) from public,anon,authenticated,service_role;
