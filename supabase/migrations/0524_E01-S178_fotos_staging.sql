-- ADR-0298: preparação privada. Não habilitar sem endpoint mediador e revisão.
create table pcm.sso_fotos_levantamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_fotos_levantamento_gate(id,habilitado) values(true,false);
create table pcm.sso_fotos_levantamento(id uuid primary key default gen_random_uuid(),cliente_id uuid not null references pcm.clientes(id),lote_id uuid not null,linha_chave text not null,objeto_id uuid not null unique,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_fotos_levantamento_gate enable row level security;alter table pcm.sso_fotos_levantamento_gate force row level security;
alter table pcm.sso_fotos_levantamento enable row level security;alter table pcm.sso_fotos_levantamento force row level security;
revoke all on pcm.sso_fotos_levantamento_gate,pcm.sso_fotos_levantamento from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sso-levantamento-fotos','sso-levantamento-fotos',false,10485760,array['image/jpeg','image/png']) on conflict(id) do nothing;
create function pcm.sso_autorizar_upload_foto_levantamento(p_nome text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_partes text[];
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then return false; end if;
  v_partes:=string_to_array(p_nome,'/');
  if array_length(v_partes,1) is distinct from 3 or exists(select 1 from unnest(v_partes) p where p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return false; end if;
  return exists(select 1 from pcm.sso_levantamentos l where l.id=v_partes[2]::uuid and l.cliente_id=v_partes[1]::uuid and config.sso_autorizar_acao('cadastro.aprovar',l.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_foto_levantamento(text) from public,anon,authenticated,service_role;
create policy s178_foto_upload on storage.objects for insert to authenticated with check(bucket_id='sso-levantamento-fotos' and owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_levantamento(name));
create policy s178_foto_upload_restrito on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'sso-levantamento-fotos' or (owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_levantamento(name)));
create policy s178_foto_sem_leitura on storage.objects as restrictive for select to authenticated using(bucket_id<>'sso-levantamento-fotos');
create policy s178_foto_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'sso-levantamento-fotos') with check(bucket_id<>'sso-levantamento-fotos');
create policy s178_foto_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'sso-levantamento-fotos');
create function pcm.sso_vincular_foto_levantamento(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_foto pcm.sso_fotos_levantamento%rowtype;v_obj uuid;
begin
  if not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_nome is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-levantamento:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.id into v_obj from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='sso-levantamento-fotos' and b.public is false and o.name=p_nome and o.owner_id=v_ator::text;
  if v_obj is null or pcm.sso_autorizar_upload_foto_levantamento(p_nome) is not true or split_part(p_nome,'/',2)<>p_lote_id::text then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
  select * into v_foto from pcm.sso_fotos_levantamento where request_id=p_request_id;
  if found then
    if v_foto.ator_id is distinct from v_ator or v_foto.lote_id is distinct from p_lote_id or v_foto.linha_chave is distinct from p_chave or v_foto.objeto_id is distinct from v_obj then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('fotoId',v_foto.id,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
  end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_fotos_levantamento(cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values(v_lote.cliente_id,p_lote_id,p_chave,v_obj,v_ator,p_request_id) returning * into v_foto;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_vinculada','sso_levantamentos',p_lote_id,jsonb_build_object('fotoId',v_foto.id,'chave',p_chave,'clienteId',v_lote.cliente_id,'requestId',p_request_id));
  return jsonb_build_object('fotoId',v_foto.id,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_vincular_foto_levantamento(uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_levantamento(p_foto_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  select o.name into v_nome from pcm.sso_fotos_levantamento f join pcm.sso_levantamentos l on l.id=f.lote_id and l.cliente_id=f.cliente_id join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos' join storage.buckets b on b.id=o.bucket_id and b.public is false where f.id=p_foto_id and config.sso_autorizar_acao('cadastro.aprovar',f.cliente_id) is true;
  if v_nome is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_levantamento(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_fotos_levantamento(p_lote_id uuid,p_chave text,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select f.id,f.criado_em from pcm.sso_fotos_levantamento f where f.lote_id=p_lote_id and f.cliente_id=v_cliente and f.linha_chave=p_chave and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_fotos_levantamento(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
