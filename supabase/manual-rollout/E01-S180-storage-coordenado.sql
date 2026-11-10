-- ADR-1063. NÃO EXECUTAR antes dos testes, revisão e aprovação operacional.
-- Exclusivo e potencialmente indisponibiliza INSERT em todos os buckets durante a transação.
begin;
do $$ begin
  if pg_catalog.current_setting('sso.storage_rollout_revisado',true) is distinct from 'sim' then
    raise exception 'rollout_storage_nao_autorizado';
  end if;
end $$;
lock table storage.objects in access exclusive mode;

-- Captura expressões e metadados efetivos antes de alterar qualquer policy.
create table pcm.sso_s180_storage_rollout_snapshot (
  id boolean primary key default true check(id), originais jsonb not null,
  instaladas jsonb, criado_em timestamptz not null default now(), revertido_em timestamptz
);
alter table pcm.sso_s180_storage_rollout_snapshot enable row level security;
alter table pcm.sso_s180_storage_rollout_snapshot force row level security;
revoke all on pcm.sso_s180_storage_rollout_snapshot from public,anon,authenticated,service_role;
insert into pcm.sso_s180_storage_rollout_snapshot(id,originais)
select true,jsonb_object_agg(policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'with_check',with_check))
from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname=any(array[
  's180_upload_comprovante','s180_limitar_upload_comprovante','s176_foto_upload','s176_foto_upload_restrito',
  's179_evidencia_upload','s179_evidencia_upload_restrito','s178_foto_upload','s178_foto_upload_restrito',
  's178_documento_upload','s178_documento_upload_restrito','s168_evidencia_upload','s168_evidencia_upload_restrito'
]) having count(*)=12;
do $$ begin
  if not exists(select 1 from pcm.sso_s180_storage_rollout_snapshot where id) then raise exception 'politicas_incompletas'; end if;
  if exists(select 1 from pcm.sso_s180_storage_rollout_snapshot s cross join lateral jsonb_each(s.originais) e
    where e.value->>'cmd' is distinct from 'INSERT' or e.value->>'with_check' is null) then raise exception 'politicas_incompativeis'; end if;
end $$;

create function pcm.sso_s180_upload_policy(p_bucket text,p_nome text,p_owner text)
returns boolean language sql volatile security definer set search_path='' as $$
  select pcm.sso_s180_dispatch_fontes_privado(p_bucket,p_nome,p_owner)
$$;
create function pcm.sso_s180_upload_guard_global(p_bucket text)
returns boolean language sql stable security definer set search_path='' as $$
  select pcm.sso_s180_guard_storage_experimental(p_bucket)
$$;
revoke all on function pcm.sso_s180_upload_policy(text,text,text),pcm.sso_s180_upload_guard_global(text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_s180_upload_policy(text,text,text),pcm.sso_s180_upload_guard_global(text) to authenticated;

alter policy s180_upload_comprovante on storage.objects with check (bucket_id='sso-despesas-visita' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s180_limitar_upload_comprovante on storage.objects with check (bucket_id<>'sso-despesas-visita' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s176_foto_upload on storage.objects with check (bucket_id='sso-grupos-fotos' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s176_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-grupos-fotos' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s179_evidencia_upload on storage.objects with check (bucket_id='sso-material-evidencias' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s179_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-material-evidencias' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s178_foto_upload on storage.objects with check (bucket_id='sso-levantamento-fotos' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s178_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-fotos' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s178_documento_upload on storage.objects with check (bucket_id='sso-levantamento-documentos' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s178_documento_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-documentos' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s168_evidencia_upload on storage.objects with check (bucket_id='sso-retorno-evidencias' and pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
alter policy s168_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-retorno-evidencias' or pcm.sso_s180_upload_policy(bucket_id,name,owner_id));
create policy s180_dispatch_guard_global on storage.objects as restrictive for insert to authenticated
  with check (pcm.sso_s180_upload_guard_global(bucket_id));
update pcm.sso_s180_storage_rollout_snapshot set instaladas=(
  select jsonb_object_agg(policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'with_check',with_check))
  from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname=any(array[
    's180_upload_comprovante','s180_limitar_upload_comprovante','s176_foto_upload','s176_foto_upload_restrito',
    's179_evidencia_upload','s179_evidencia_upload_restrito','s178_foto_upload','s178_foto_upload_restrito',
    's178_documento_upload','s178_documento_upload_restrito','s168_evidencia_upload','s168_evidencia_upload_restrito',
    's180_dispatch_guard_global'
  ]) having count(*)=13
) where id;
do $$ begin
  if not exists(select 1 from pcm.sso_s180_storage_rollout_snapshot where id and instaladas is not null) then raise exception 'fotografia_instalada_incompleta'; end if;
end $$;
commit;
