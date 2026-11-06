-- ADR-0335: associação temporária privada, sem cópia ou alteração legada.
create table pcm.sso_documento_staging_ativo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_documento_staging_ativo_gate(id,habilitado) values(true,false);
create table pcm.sso_documento_staging_ativo(id uuid primary key default gen_random_uuid(),documento_id uuid not null unique references pcm.sso_documentos_levantamento(id),tipo text not null check(tipo in ('grupo_quantitativo','sistema','componente')),entidade_id uuid not null,cliente_id uuid not null references pcm.clientes(id),decisao_revision integer not null check(decisao_revision>0),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_documento_staging_ativo_gate enable row level security;alter table pcm.sso_documento_staging_ativo_gate force row level security;
alter table pcm.sso_documento_staging_ativo enable row level security;alter table pcm.sso_documento_staging_ativo force row level security;
revoke all on pcm.sso_documento_staging_ativo_gate,pcm.sso_documento_staging_ativo from public,anon,authenticated,service_role;
create function pcm.sso_vincular_documento_staging_ativo(p_request_id uuid,p_documento_id uuid,p_tipo text,p_entidade_id uuid,p_decisao_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_doc pcm.sso_documentos_levantamento%rowtype;v_dec pcm.sso_decisoes_documento_levantamento%rowtype;v_ant pcm.sso_documento_staging_ativo%rowtype;v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_documento_staging_ativo_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_documento_id is null or p_tipo is null or p_tipo not in ('grupo_quantitativo','sistema','componente') or p_entidade_id is null or p_decisao_revision is null or p_decisao_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-staging-ativo:'||p_request_id::text,0));
  select * into v_doc from pcm.sso_documentos_levantamento where id=p_documento_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_doc.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_doc.cliente_id) is not true then raise exception 'documento_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_documento_staging_ativo where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.documento_id is distinct from p_documento_id or v_ant.tipo is distinct from p_tipo or v_ant.entidade_id is distinct from p_entidade_id or v_ant.decisao_revision<>p_decisao_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('vinculoId',v_ant.id,'documentoId',p_documento_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
  end if;
  if p_tipo='sistema' then perform 1 from pcm.sistemas where id=p_entidade_id and cliente_id=v_doc.cliente_id and ativo and deleted_at is null for update;
  elsif p_tipo='componente' then perform 1 from pcm.equipamentos where id=p_entidade_id and client_id=v_doc.cliente_id and tipo='componente' and ativo and deleted_at is null for update;
  else perform 1 from pcm.grupos_quantitativos where id=p_entidade_id and cliente_id=v_doc.cliente_id and ativo and deleted_at is null for update; end if;
  if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_doc.lote_id and i.linha_chave=v_doc.linha_chave and i.tipo=p_tipo and i.entidade_id=p_entidade_id) then raise exception 'ativo_ou_incorporacao_invalida' using errcode='23514'; end if;
  select * into v_dec from pcm.sso_decisoes_documento_levantamento where documento_id=p_documento_id order by revisao desc limit 1;
  if not found or v_dec.revisao<>p_decisao_revision or v_dec.decisao<>'aceito' then raise exception 'documento_nao_aceito_ou_decisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_documento_staging_ativo(documento_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values(p_documento_id,p_tipo,p_entidade_id,v_doc.cliente_id,p_decisao_revision,v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.documento_ativo_vinculado','sso_levantamentos',v_doc.lote_id,jsonb_build_object('clienteId',v_doc.cliente_id,'documentoId',p_documento_id,'vinculoId',v_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'decisaoRevision',p_decisao_revision,'requestId',p_request_id));
  return jsonb_build_object('vinculoId',v_id,'documentoId',p_documento_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_vincular_documento_staging_ativo(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_documento_staging_ativo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if not coalesce((select habilitado from pcm.sso_documento_staging_ativo_gate where id),false) or not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then raise exception 'documentos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select o.name into v_nome from pcm.sso_documento_staging_ativo x join pcm.sso_documentos_levantamento d on d.id=x.documento_id and d.cliente_id=x.cliente_id join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos' join storage.buckets b on b.id=o.bucket_id and b.public is false
    join lateral (select a.decisao from pcm.sso_decisoes_documento_levantamento a where a.documento_id=d.id order by a.revisao desc limit 1) u on u.decisao='aceito'
    where x.id=p_vinculo_id and (config.sso_autorizar_acao('cadastro.ler',x.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',x.cliente_id) is true)
    and ((x.tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=x.entidade_id and s.cliente_id=x.cliente_id and s.ativo and s.deleted_at is null)) or (x.tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=x.entidade_id and e.client_id=x.cliente_id and e.tipo='componente' and e.ativo and e.deleted_at is null)) or (x.tipo='grupo_quantitativo' and exists(select 1 from pcm.grupos_quantitativos g where g.id=x.entidade_id and g.cliente_id=x.cliente_id and g.ativo and g.deleted_at is null)));
  if v_nome is null then raise exception 'documento_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_documento_staging_ativo(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_destino_documento_ativo(p_documento_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_doc pcm.sso_documentos_levantamento%rowtype;v_inc pcm.sso_levantamento_incorporacoes%rowtype;v_dec pcm.sso_decisoes_documento_levantamento%rowtype;v_existe boolean;
begin
  if not coalesce((select habilitado from pcm.sso_documento_staging_ativo_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_documento_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_doc from pcm.sso_documentos_levantamento where id=p_documento_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_doc.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_doc.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_inc from pcm.sso_levantamento_incorporacoes where lote_id=v_doc.lote_id and linha_chave=v_doc.linha_chave and tipo in ('grupo_quantitativo','sistema','componente');
  select * into v_dec from pcm.sso_decisoes_documento_levantamento where documento_id=p_documento_id order by revisao desc limit 1;
  select exists(select 1 from pcm.sso_documento_staging_ativo where documento_id=p_documento_id) into v_existe;
  return jsonb_build_object('documentoId',p_documento_id,'tipo',v_inc.tipo,'entidadeId',v_inc.entidade_id,'decisao',v_dec.decisao,'revision',coalesce(v_dec.revisao,0),'vinculado',v_existe);
end;
$$;
revoke all on function pcm.sso_consultar_destino_documento_ativo(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_documentos_staging_ativo(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,titulo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_documento_staging_ativo_gate where id),false) or not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then raise exception 'documentos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is null or p_tipo not in ('grupo_quantitativo','sistema','componente') or p_entidade_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='sistema' then select s.cliente_id into v_cliente from pcm.sistemas s where s.id=p_entidade_id and s.ativo and s.deleted_at is null;
  elsif p_tipo='componente' then select e.client_id into v_cliente from pcm.equipamentos e where e.id=p_entidade_id and e.tipo='componente' and e.ativo and e.deleted_at is null;
  else select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id=p_entidade_id and g.ativo and g.deleted_at is null; end if;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.id,d.titulo,x.criado_em from pcm.sso_documento_staging_ativo x join pcm.sso_documentos_levantamento d on d.id=x.documento_id and d.cliente_id=x.cliente_id join lateral (select a.decisao from pcm.sso_decisoes_documento_levantamento a where a.documento_id=d.id order by a.revisao desc limit 1) u on u.decisao='aceito' where x.tipo=p_tipo and x.entidade_id=p_entidade_id and x.cliente_id=v_cliente and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
