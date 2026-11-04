-- ADR-0315: associação temporária privada, sem copiar objeto ou modificar legado.
create table pcm.sso_foto_staging_ativo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_foto_staging_ativo_gate(id,habilitado) values(true,false);
create table pcm.sso_foto_staging_ativo(id uuid primary key default gen_random_uuid(),foto_id uuid not null unique references pcm.sso_fotos_levantamento(id),tipo text not null check(tipo in ('sistema','componente')),entidade_id uuid not null,cliente_id uuid not null references pcm.clientes(id),decisao_revision integer not null check(decisao_revision>0),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_foto_staging_ativo_gate enable row level security;alter table pcm.sso_foto_staging_ativo_gate force row level security;
alter table pcm.sso_foto_staging_ativo enable row level security;alter table pcm.sso_foto_staging_ativo force row level security;
revoke all on pcm.sso_foto_staging_ativo_gate,pcm.sso_foto_staging_ativo from public,anon,authenticated,service_role;
create function pcm.sso_vincular_foto_staging_ativo(p_request_id uuid,p_foto_id uuid,p_tipo text,p_entidade_id uuid,p_decisao_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_foto pcm.sso_fotos_levantamento%rowtype;v_decisao pcm.sso_decisoes_foto_levantamento%rowtype;v_anterior pcm.sso_foto_staging_ativo%rowtype;v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_ativo_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_foto_id is null or p_tipo is null or p_tipo not in ('sistema','componente') or p_entidade_id is null or p_decisao_revision is null or p_decisao_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-staging-ativo:'||p_request_id::text,0));
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_anterior from pcm.sso_foto_staging_ativo where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.foto_id is distinct from p_foto_id or v_anterior.tipo is distinct from p_tipo or v_anterior.entidade_id is distinct from p_entidade_id or v_anterior.decisao_revision<>p_decisao_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('vinculoId',v_anterior.id,'fotoId',p_foto_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
  end if;
  if p_tipo='sistema' then perform 1 from pcm.sistemas where id=p_entidade_id and cliente_id=v_foto.cliente_id and ativo and deleted_at is null for update;
  else perform 1 from pcm.equipamentos where id=p_entidade_id and client_id=v_foto.cliente_id and tipo='componente' and ativo and deleted_at is null for update; end if;
  if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo=p_tipo and i.entidade_id=p_entidade_id) then raise exception 'ativo_ou_incorporacao_invalida' using errcode='23514'; end if;
  select * into v_decisao from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
  if not found or v_decisao.revisao<>p_decisao_revision or v_decisao.decisao<>'aceita' then raise exception 'foto_nao_aceita_ou_decisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_foto_staging_ativo(foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values(p_foto_id,p_tipo,p_entidade_id,v_foto.cliente_id,p_decisao_revision,v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_ativo_vinculada','sso_levantamentos',v_foto.lote_id,jsonb_build_object('clienteId',v_foto.cliente_id,'fotoId',p_foto_id,'vinculoId',v_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'decisaoRevision',p_decisao_revision,'requestId',p_request_id));
  return jsonb_build_object('vinculoId',v_id,'fotoId',p_foto_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_vincular_foto_staging_ativo(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_destino_foto_ativo(p_foto_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_foto pcm.sso_fotos_levantamento%rowtype;v_inc pcm.sso_levantamento_incorporacoes%rowtype;v_dec pcm.sso_decisoes_foto_levantamento%rowtype;v_existe boolean;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_ativo_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_foto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_inc from pcm.sso_levantamento_incorporacoes where lote_id=v_foto.lote_id and linha_chave=v_foto.linha_chave and tipo in ('sistema','componente');
  select * into v_dec from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
  select exists(select 1 from pcm.sso_foto_staging_ativo where foto_id=p_foto_id) into v_existe;
  return jsonb_build_object('fotoId',p_foto_id,'tipo',v_inc.tipo,'entidadeId',v_inc.entidade_id,'decisao',v_dec.decisao,'revision',coalesce(v_dec.revisao,0),'vinculado',v_existe);
end;
$$;
revoke all on function pcm.sso_consultar_destino_foto_ativo(uuid) from public,anon,authenticated,service_role;
