-- ADR-1673. Não concede funções privadas nem altera os gates dos buckets.
do $migration$
declare
 item record;
 alvo oid := 'storage.objects'::regclass;
 referencia oid;
 papel oid := (select oid from pg_catalog.pg_roles where rolname='authenticated');
 expressao text;
 esperada text;
 atual text;
begin
 if papel is null then raise exception 'papel_storage_indisponivel' using errcode='55000'; end if;
 create temporary table sso_policy_upload_referencia(bucket_id text,owner_id text,name text) on commit drop;
 alter table pg_temp.sso_policy_upload_referencia enable row level security;
 referencia := 'pg_temp.sso_policy_upload_referencia'::regclass;
 for item in select * from (values
  ('s176_foto_upload', 'sso-grupos-fotos', 'sso_autorizar_upload_foto_grupo', true),
  ('s176_foto_upload_restrito', 'sso-grupos-fotos', 'sso_autorizar_upload_foto_grupo', false),
  ('s178_foto_upload', 'sso-levantamento-fotos', 'sso_autorizar_upload_foto_levantamento', true),
  ('s178_foto_upload_restrito', 'sso-levantamento-fotos', 'sso_autorizar_upload_foto_levantamento', false),
  ('s178_documento_upload', 'sso-levantamento-documentos', 'sso_autorizar_upload_documento_levantamento', true),
  ('s178_documento_upload_restrito', 'sso-levantamento-documentos', 'sso_autorizar_upload_documento_levantamento', false)
 ) as p(nome,bucket,helper,permissiva)
 loop
  expressao := case when item.permissiva then
    pg_catalog.format('(bucket_id=%L and owner_id=auth.uid()::text and pcm.%I(name))',item.bucket,item.helper)
   else pg_catalog.format('(bucket_id<>%L or (owner_id=auth.uid()::text and pcm.%I(name)))',item.bucket,item.helper) end;
  execute pg_catalog.format('create policy sso_comparar on pg_temp.sso_policy_upload_referencia for insert to authenticated with check (%s)',expressao);
  select pg_catalog.pg_get_expr(polwithcheck,polrelid) into esperada from pg_catalog.pg_policy where polrelid=referencia and polname='sso_comparar';
  execute 'drop policy sso_comparar on pg_temp.sso_policy_upload_referencia';
  select pg_catalog.pg_get_expr(polwithcheck,polrelid) into atual from pg_catalog.pg_policy
   where polrelid=alvo and polname=item.nome and polcmd='a' and polpermissive=item.permissiva
    and polroles=array[papel]::oid[] and polqual is null;
  if atual is null or atual is distinct from esperada then
   raise exception 'policy_storage_incompativel: %',item.nome using errcode='55000';
  end if;
  execute pg_catalog.format('alter policy %I on storage.objects with check (case when bucket_id=%L then %s else %s end)',
   item.nome,'sso-retorno-evidencias',case when item.permissiva then 'false' else 'true' end,expressao);
 end loop;
end;
$migration$;
