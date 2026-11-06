-- ADR-0328: fundação privada, sem busca de URLs nem incorporação automática.
create table pcm.sso_documentos_levantamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_documentos_levantamento_gate(id,habilitado) values(true,false);
create table pcm.sso_documentos_levantamento(id uuid primary key default gen_random_uuid(),cliente_id uuid not null references pcm.clientes(id),lote_id uuid not null,linha_chave text not null,objeto_id uuid not null unique,titulo text not null check(length(btrim(titulo)) between 1 and 200),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_documentos_levantamento_gate enable row level security;alter table pcm.sso_documentos_levantamento_gate force row level security;
alter table pcm.sso_documentos_levantamento enable row level security;alter table pcm.sso_documentos_levantamento force row level security;
revoke all on pcm.sso_documentos_levantamento_gate,pcm.sso_documentos_levantamento from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sso-levantamento-documentos','sso-levantamento-documentos',false,10485760,array['application/pdf']) on conflict(id) do nothing;
create function pcm.sso_autorizar_upload_documento_levantamento(p_nome text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_partes text[];
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then return false; end if;
  v_partes:=string_to_array(p_nome,'/');
  if array_length(v_partes,1) is distinct from 3 or exists(select 1 from unnest(v_partes) p where p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return false; end if;
  return exists(select 1 from pcm.sso_levantamentos l where l.id=v_partes[2]::uuid and l.cliente_id=v_partes[1]::uuid and config.sso_autorizar_acao('cadastro.aprovar',l.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_documento_levantamento(text) from public,anon,authenticated,service_role;
create policy s178_documento_upload on storage.objects for insert to authenticated with check(bucket_id='sso-levantamento-documentos' and owner_id=auth.uid()::text and pcm.sso_autorizar_upload_documento_levantamento(name));
create policy s178_documento_upload_restrito on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'sso-levantamento-documentos' or (owner_id=auth.uid()::text and pcm.sso_autorizar_upload_documento_levantamento(name)));
create policy s178_documento_sem_leitura on storage.objects as restrictive for select to authenticated using(bucket_id<>'sso-levantamento-documentos');
create policy s178_documento_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'sso-levantamento-documentos') with check(bucket_id<>'sso-levantamento-documentos');
create policy s178_documento_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'sso-levantamento-documentos');
create function pcm.sso_vincular_documento_levantamento(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text,p_titulo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_doc pcm.sso_documentos_levantamento%rowtype;v_obj uuid;
begin
  if not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then raise exception 'documentos_desabilitados' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_nome is null or p_titulo is null or length(btrim(p_titulo)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-levantamento:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.id into v_obj from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='sso-levantamento-documentos' and b.public is false and o.name=p_nome and o.owner_id=v_ator::text;
  if v_obj is null or pcm.sso_autorizar_upload_documento_levantamento(p_nome) is not true or split_part(p_nome,'/',2)<>p_lote_id::text then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
  select * into v_doc from pcm.sso_documentos_levantamento where request_id=p_request_id;
  if found then
    if v_doc.ator_id is distinct from v_ator or v_doc.lote_id is distinct from p_lote_id or v_doc.linha_chave is distinct from p_chave or v_doc.objeto_id is distinct from v_obj or v_doc.titulo is distinct from btrim(p_titulo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('documentoId',v_doc.id,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
  end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_documentos_levantamento(cliente_id,lote_id,linha_chave,objeto_id,titulo,ator_id,request_id) values(v_lote.cliente_id,p_lote_id,p_chave,v_obj,btrim(p_titulo),v_ator,p_request_id) returning * into v_doc;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.documento_vinculado','sso_levantamentos',p_lote_id,jsonb_build_object('documentoId',v_doc.id,'chave',p_chave,'clienteId',v_lote.cliente_id,'requestId',p_request_id));
  return jsonb_build_object('documentoId',v_doc.id,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_vincular_documento_levantamento(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_documentos_levantamento(p_lote_id uuid,p_chave text,p_apos uuid,p_limite integer)
returns table(id uuid,titulo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then raise exception 'documentos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.id,d.titulo,d.criado_em from pcm.sso_documentos_levantamento d where d.cliente_id=v_cliente and d.lote_id=p_lote_id and d.linha_chave=p_chave and (p_apos is null or d.id>p_apos) order by d.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_documentos_levantamento(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_documento_levantamento(p_documento_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if not coalesce((select habilitado from pcm.sso_documentos_levantamento_gate where id),false) then raise exception 'documentos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_documento_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select o.name into v_nome from pcm.sso_documentos_levantamento d join pcm.sso_levantamentos l on l.id=d.lote_id and l.cliente_id=d.cliente_id join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos' join storage.buckets b on b.id=o.bucket_id and b.public is false where d.id=p_documento_id and config.sso_autorizar_acao('cadastro.aprovar',d.cliente_id) is true;
  if v_nome is null then raise exception 'documento_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_documento_levantamento(uuid) from public,anon,authenticated,service_role;
