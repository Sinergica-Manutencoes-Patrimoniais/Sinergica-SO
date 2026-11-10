-- ADR-0159: rollout fechado; funções deliberadamente revogadas.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sso-grupos-fotos','sso-grupos-fotos',false,10485760,array['image/jpeg','image/png']) on conflict(id) do nothing;
create function pcm.sso_autorizar_upload_foto_grupo(p_nome text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_partes text[];
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.sso_grupo_fotos_gate where id),false) then return false; end if;
  v_partes:=string_to_array(p_nome,'/');
  if array_length(v_partes,1) is distinct from 3 or exists(select 1 from unnest(v_partes) p
    where p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return false; end if;
  return exists(select 1 from pcm.grupos_quantitativos g where g.id=v_partes[2]::uuid and g.cliente_id=v_partes[1]::uuid
    and g.ativo and g.deleted_at is null and config.sso_autorizar_acao('cadastro.gerir',g.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_foto_grupo(text) from public,anon,authenticated,service_role;
create policy s176_foto_upload on storage.objects for insert to authenticated with check(bucket_id='sso-grupos-fotos' and owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_grupo(name));
create policy s176_foto_upload_restrito on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'sso-grupos-fotos' or (owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_grupo(name)));
create policy s176_foto_sem_leitura_direta on storage.objects as restrictive for select to authenticated using(bucket_id<>'sso-grupos-fotos');
create policy s176_foto_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'sso-grupos-fotos') with check(bucket_id<>'sso-grupos-fotos');
create policy s176_foto_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'sso-grupos-fotos');

create function pcm.sso_resolver_upload_foto_grupo(p_nome text) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if pcm.sso_autorizar_upload_foto_grupo(p_nome) is not true then raise exception 'objeto_indisponivel' using errcode='42501'; end if;
  select o.id into v_id from storage.objects o join storage.buckets b on b.id=o.bucket_id
    where o.bucket_id='sso-grupos-fotos' and b.public is false and o.name=p_nome and o.owner_id=auth.uid()::text;
  if v_id is null then raise exception 'objeto_indisponivel' using errcode='42501'; end if;
  return v_id;
end;
$$;
revoke all on function pcm.sso_resolver_upload_foto_grupo(text) from public,anon,authenticated,service_role;

create function pcm.sso_caminho_foto_grupo(p_foto_id uuid) returns text language plpgsql stable security definer set search_path = '' as $$
declare v_nome text;
begin
  select o.name into v_nome from pcm.sso_grupo_fotos f join pcm.grupos_quantitativos g on g.id=f.grupo_id and g.cliente_id=f.cliente_id
    join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-grupos-fotos'
    join storage.buckets b on b.id=o.bucket_id and b.public is false
    where f.id=p_foto_id and (config.sso_autorizar_acao('cadastro.ler',f.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',f.cliente_id) is true);
  if v_nome is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_grupo(uuid) from public,anon,authenticated,service_role;
