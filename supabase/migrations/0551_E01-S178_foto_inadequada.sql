-- ADR-0325: registro privado, bloqueio de destinos sem exclusão.
create table pcm.sso_adequacao_foto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_adequacao_foto_gate(id,habilitado) values(true,false);
create table pcm.sso_adequacao_foto_decisoes(id uuid primary key default gen_random_uuid(),foto_id uuid not null references pcm.sso_fotos_levantamento(id),revisao integer not null check(revisao>0),estado text not null check(estado in ('inadequada','reavaliada')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(foto_id,revisao));
alter table pcm.sso_adequacao_foto_gate enable row level security;alter table pcm.sso_adequacao_foto_gate force row level security;
alter table pcm.sso_adequacao_foto_decisoes enable row level security;alter table pcm.sso_adequacao_foto_decisoes force row level security;
revoke all on pcm.sso_adequacao_foto_gate,pcm.sso_adequacao_foto_decisoes from public,anon,authenticated,service_role;
create function pcm.sso_adequacao_foto_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_adequacao_foto_imutavel() from public,anon,authenticated,service_role;
create trigger sso_adequacao_foto_imutavel before update or delete on pcm.sso_adequacao_foto_decisoes for each row execute function pcm.sso_adequacao_foto_imutavel();
create function pcm.sso_marcar_adequacao_foto(p_request_id uuid,p_foto_id uuid,p_expected_revision integer,p_estado text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_foto pcm.sso_fotos_levantamento%rowtype;v_ant pcm.sso_adequacao_foto_decisoes%rowtype;v_rev integer;
begin
  if not coalesce((select habilitado from pcm.sso_adequacao_foto_gate where id),false) then raise exception 'adequacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_foto_id is null or p_expected_revision is null or p_expected_revision<0 or p_estado is null or p_estado not in ('inadequada','reavaliada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('adequacao-foto:'||p_request_id::text,0));
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_adequacao_foto_decisoes where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.foto_id is distinct from p_foto_id or v_ant.revisao<>p_expected_revision+1 or v_ant.estado is distinct from p_estado or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('fotoId',p_foto_id,'revision',v_ant.revisao,'estado',v_ant.estado,'requestId',p_request_id);
  end if;
  select coalesce(max(revisao),0) into v_rev from pcm.sso_adequacao_foto_decisoes where foto_id=p_foto_id;
  if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_adequacao_foto_decisoes(foto_id,revisao,estado,motivo,ator_id,request_id) values(p_foto_id,v_rev+1,p_estado,btrim(p_motivo),v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_adequacao','sso_levantamentos',v_foto.lote_id,jsonb_build_object('clienteId',v_foto.cliente_id,'fotoId',p_foto_id,'revision',v_rev+1,'estado',p_estado,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('fotoId',p_foto_id,'revision',v_rev+1,'estado',p_estado,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_marcar_adequacao_foto(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_foto_inadequada(p_foto_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select d.estado='inadequada' from pcm.sso_adequacao_foto_decisoes d where d.foto_id=p_foto_id order by d.revisao desc limit 1),false); $$;
revoke all on function pcm.sso_foto_inadequada(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_bloquear_vinculo_foto_inadequada() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from pcm.sso_fotos_levantamento where id=new.foto_id for update;
  if pcm.sso_foto_inadequada(new.foto_id) then raise exception 'foto_inadequada' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_bloquear_vinculo_foto_inadequada() from public,anon,authenticated,service_role;
create trigger sso_bloquear_foto_inadequada before insert on pcm.sso_foto_staging_grupo for each row execute function pcm.sso_bloquear_vinculo_foto_inadequada();
create trigger sso_bloquear_foto_inadequada before insert on pcm.sso_foto_staging_ativo for each row execute function pcm.sso_bloquear_vinculo_foto_inadequada();
alter function pcm.sso_caminho_foto_staging_grupo(uuid) rename to sso_caminho_foto_staging_grupo_interno;
revoke all on function pcm.sso_caminho_foto_staging_grupo_interno(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_staging_grupo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;v_foto uuid;
begin
  v_nome:=pcm.sso_caminho_foto_staging_grupo_interno(p_vinculo_id);
  select foto_id into v_foto from pcm.sso_foto_staging_grupo where id=p_vinculo_id;
  if v_foto is null or pcm.sso_foto_inadequada(v_foto) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_staging_grupo(uuid) from public,anon,authenticated,service_role;
alter function pcm.sso_caminho_foto_staging_ativo(uuid) rename to sso_caminho_foto_staging_ativo_interno;
revoke all on function pcm.sso_caminho_foto_staging_ativo_interno(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_staging_ativo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;v_foto uuid;
begin
  v_nome:=pcm.sso_caminho_foto_staging_ativo_interno(p_vinculo_id);
  select foto_id into v_foto from pcm.sso_foto_staging_ativo where id=p_vinculo_id;
  if v_foto is null or pcm.sso_foto_inadequada(v_foto) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_staging_ativo(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_adequacao_foto(p_foto_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_adequacao_foto_gate where id),false) then raise exception 'adequacao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_foto_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select f.cliente_id into v_cliente from pcm.sso_fotos_levantamento f where f.id=p_foto_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.revisao,d.estado,d.motivo,d.ator_id,d.criado_em from pcm.sso_adequacao_foto_decisoes d where d.foto_id=p_foto_id and (p_apos is null or d.revisao>p_apos) order by d.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_adequacao_foto(uuid,integer,integer) from public,anon,authenticated,service_role;
