-- ADR-0311: associação de proveniência privada; nenhum byte é copiado.
create table pcm.sso_foto_staging_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_foto_staging_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_foto_staging_grupo(id uuid primary key default gen_random_uuid(),foto_id uuid not null unique references pcm.sso_fotos_levantamento(id),grupo_id uuid not null references pcm.grupos_quantitativos(id),cliente_id uuid not null references pcm.clientes(id),decisao_revision integer not null check(decisao_revision>0),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_foto_staging_grupo_gate enable row level security;alter table pcm.sso_foto_staging_grupo_gate force row level security;
alter table pcm.sso_foto_staging_grupo enable row level security;alter table pcm.sso_foto_staging_grupo force row level security;
revoke all on pcm.sso_foto_staging_grupo_gate,pcm.sso_foto_staging_grupo from public,anon,authenticated,service_role;
create function pcm.sso_vincular_foto_staging_grupo(p_request_id uuid,p_foto_id uuid,p_grupo_id uuid,p_decisao_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_foto pcm.sso_fotos_levantamento%rowtype;v_grupo pcm.grupos_quantitativos%rowtype;v_decisao pcm.sso_decisoes_foto_levantamento%rowtype;v_anterior pcm.sso_foto_staging_grupo%rowtype;v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_grupo_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_foto_id is null or p_grupo_id is null or p_decisao_revision is null or p_decisao_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-staging-grupo:'||p_request_id::text,0));
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_anterior from pcm.sso_foto_staging_grupo where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.foto_id is distinct from p_foto_id or v_anterior.grupo_id is distinct from p_grupo_id or v_anterior.decisao_revision<>p_decisao_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('vinculoId',v_anterior.id,'fotoId',p_foto_id,'grupoId',p_grupo_id,'revision',p_decisao_revision,'requestId',p_request_id);
  end if;
  select * into v_grupo from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=v_foto.cliente_id and ativo and deleted_at is null for update;
  if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo='grupo_quantitativo' and i.entidade_id=p_grupo_id) then raise exception 'grupo_ou_incorporacao_invalida' using errcode='23514'; end if;
  select * into v_decisao from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
  if not found or v_decisao.revisao<>p_decisao_revision or v_decisao.decisao<>'aceita' then raise exception 'foto_nao_aceita_ou_decisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_foto_staging_grupo(foto_id,grupo_id,cliente_id,decisao_revision,ator_id,request_id) values(p_foto_id,p_grupo_id,v_foto.cliente_id,p_decisao_revision,v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'grupo.foto_levantamento_vinculada','grupos_quantitativos',p_grupo_id,jsonb_build_object('clienteId',v_foto.cliente_id,'fotoId',p_foto_id,'vinculoId',v_id,'decisaoRevision',p_decisao_revision,'requestId',p_request_id));
  return jsonb_build_object('vinculoId',v_id,'fotoId',p_foto_id,'grupoId',p_grupo_id,'revision',p_decisao_revision,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_vincular_foto_staging_grupo(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
