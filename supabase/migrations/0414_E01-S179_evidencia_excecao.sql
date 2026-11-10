-- ADR-0188: preparado apenas; gate e funções fechados.
create table pcm.sso_material_evidencia_gate (id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_material_evidencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_material_evidencia_gate enable row level security;
alter table pcm.sso_material_evidencia_gate force row level security;
revoke all on pcm.sso_material_evidencia_gate from public,anon,authenticated,service_role;
create table pcm.sso_material_evidencias (
  id uuid primary key default gen_random_uuid(), lista_id uuid not null references pcm.listas_materiais(id),
  evento_revision integer not null, objeto_id uuid not null unique, cliente_id uuid not null references pcm.clientes(id),
  criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(),
  foreign key(lista_id,evento_revision) references pcm.sso_lista_materiais_eventos(lista_id,revisao)
);
create table pcm.sso_material_evidencia_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),payload jsonb not null,resultado jsonb not null);
alter table pcm.sso_material_evidencias enable row level security;
alter table pcm.sso_material_evidencias force row level security;
alter table pcm.sso_material_evidencia_comandos enable row level security;
alter table pcm.sso_material_evidencia_comandos force row level security;
revoke all on pcm.sso_material_evidencias,pcm.sso_material_evidencia_comandos from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sso-material-evidencias','sso-material-evidencias',false,10485760,array['image/jpeg','image/png']) on conflict(id) do nothing;

create function pcm.sso_autorizar_upload_evidencia_material(p_nome text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v text[];
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.sso_material_evidencia_gate where id),false) then return false; end if;
  v:=string_to_array(p_nome,'/');
  if array_length(v,1) is distinct from 4 or v[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or v[3] !~ '^[1-9][0-9]{0,8}$'
    or v[4] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists(select 1 from pcm.listas_materiais l join pcm.sso_lista_materiais_eventos e on e.lista_id=l.id and e.revisao=v[3]::integer and e.tipo='excecao'
    join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
    where l.id=v[2]::uuid and l.cliente_id=v[1]::uuid and config.sso_autorizar_acao('material.gerir',l.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_evidencia_material(text) from public,anon,authenticated,service_role;
create policy s179_evidencia_upload on storage.objects for insert to authenticated with check(bucket_id='sso-material-evidencias' and owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_material(name));
create policy s179_evidencia_upload_restrito on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'sso-material-evidencias' or (owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_material(name)));
create policy s179_evidencia_sem_leitura on storage.objects as restrictive for select to authenticated using(bucket_id<>'sso-material-evidencias');
create policy s179_evidencia_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'sso-material-evidencias') with check(bucket_id<>'sso-material-evidencias');
create policy s179_evidencia_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'sso-material-evidencias');

create function pcm.sso_resolver_upload_evidencia_material(p_nome text) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if pcm.sso_autorizar_upload_evidencia_material(p_nome) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.id into v_id from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='sso-material-evidencias' and b.public is false and o.name=p_nome and o.owner_id=auth.uid()::text;
  if v_id is null then raise exception 'sem_acesso' using errcode='42501'; end if; return v_id;
end;
$$;
revoke all on function pcm.sso_resolver_upload_evidencia_material(text) from public,anon,authenticated,service_role;

create function pcm.sso_vincular_evidencia_material(p_request_id uuid,p_lista_id uuid,p_evento_revision integer,p_objeto_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid:=auth.uid(); v_lista pcm.listas_materiais%rowtype; v_cmd pcm.sso_material_evidencia_comandos%rowtype; v_nome text; v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_material_evidencia_gate where id),false) then raise exception 'evidencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('listaId',p_lista_id,'eventoRevision',p_evento_revision,'objetoId',p_objeto_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('material-evidencia:'||p_request_id::text,0));
  select * into v_cmd from pcm.sso_material_evidencia_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('material.gerir',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado;
  end if;
  select * into v_lista from pcm.listas_materiais where id=p_lista_id for update;
  if not found or config.sso_autorizar_acao('material.gerir',v_lista.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.name into v_nome from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
    where o.id=p_objeto_id and o.bucket_id='sso-material-evidencias' and o.owner_id=v_ator::text for share of o;
  if v_nome is null or split_part(v_nome,'/',1)<>v_lista.cliente_id::text or split_part(v_nome,'/',2)<>p_lista_id::text
    or split_part(v_nome,'/',3)<>p_evento_revision::text or pcm.sso_autorizar_upload_evidencia_material(v_nome) is not true then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_material_evidencias(lista_id,evento_revision,objeto_id,cliente_id,criado_por) values(p_lista_id,p_evento_revision,p_objeto_id,v_lista.cliente_id,v_ator) returning id into v_id;
  v_resultado:=jsonb_build_object('evidenciaId',v_id,'listaId',p_lista_id,'eventoRevision',p_evento_revision,'requestId',p_request_id);
  insert into pcm.sso_material_evidencia_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_lista.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'material.evidencia_vinculada','listas_materiais',p_lista_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lista.cliente_id,'eventoRevision',p_evento_revision,'evidenciaId',v_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_evidencia_material(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_material(p_lista_id uuid,p_evento_revision integer,p_apos uuid,p_limite integer) returns table(id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.listas_materiais l join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.client_id=l.cliente_id and o.deleted_at is null where l.id=p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select e.id,e.criado_em from pcm.sso_material_evidencias e where e.lista_id=p_lista_id and e.evento_revision=p_evento_revision and e.cliente_id=v_cliente and (p_apos is null or e.id>p_apos) order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_evidencias_material(uuid,integer,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_caminho_evidencia_material(p_evidencia_id uuid) returns text language plpgsql stable security definer set search_path = '' as $$
declare v_nome text;
begin
  select o.name into v_nome from pcm.sso_material_evidencias e join pcm.listas_materiais l on l.id=e.lista_id and l.cliente_id=e.cliente_id
    join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
    join storage.objects o on o.id=e.objeto_id and o.bucket_id='sso-material-evidencias' join storage.buckets b on b.id=o.bucket_id and b.public is false
    where e.id=p_evidencia_id and config.sso_autorizar_acao('material.gerir',e.cliente_id) is true;
  if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_evidencia_material(uuid) from public,anon,authenticated,service_role;
