-- ADR-1674: não amplia privilégios dos helpers nem altera gates.
create function pcm.sso_predicado_upload_bucket_invocador(p_bucket text,p_nome text)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if p_bucket='sso-grupos-fotos' then
  if not pg_catalog.has_function_privilege(current_user,'pcm.sso_autorizar_upload_foto_grupo(text)','EXECUTE') then return false; end if;
  return pcm.sso_autorizar_upload_foto_grupo(p_nome);
 elsif p_bucket='sso-levantamento-fotos' then
  if not pg_catalog.has_function_privilege(current_user,'pcm.sso_autorizar_upload_foto_levantamento(text)','EXECUTE') then return false; end if;
  return pcm.sso_autorizar_upload_foto_levantamento(p_nome);
 elsif p_bucket='sso-levantamento-documentos' then
  if not pg_catalog.has_function_privilege(current_user,'pcm.sso_autorizar_upload_documento_levantamento(text)','EXECUTE') then return false; end if;
  return pcm.sso_autorizar_upload_documento_levantamento(p_nome);
 end if;
 return false;
end; $$;
revoke all on function pcm.sso_predicado_upload_bucket_invocador(text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_predicado_upload_bucket_invocador(text,text) to authenticated;

do $migration$
declare
 item record;
 alvo oid := 'storage.objects'::regclass;
 referencia oid;
 papel oid := (select oid from pg_catalog.pg_roles where rolname='authenticated');
 antiga text;
 nova text;
 esperada text;
 atual text;
begin
 if papel is null then raise exception 'papel_storage_indisponivel' using errcode='55000'; end if;
 create temporary table sso_policy_upload_referencia_1815(bucket_id text,owner_id text,name text) on commit drop;
 alter table pg_temp.sso_policy_upload_referencia_1815 enable row level security;
 referencia := 'pg_temp.sso_policy_upload_referencia_1815'::regclass;
 for item in select * from (values
  ('s176_foto_upload', 'sso-grupos-fotos', 'sso_autorizar_upload_foto_grupo', true),
  ('s176_foto_upload_restrito', 'sso-grupos-fotos', 'sso_autorizar_upload_foto_grupo', false),
  ('s178_foto_upload', 'sso-levantamento-fotos', 'sso_autorizar_upload_foto_levantamento', true),
  ('s178_foto_upload_restrito', 'sso-levantamento-fotos', 'sso_autorizar_upload_foto_levantamento', false),
  ('s178_documento_upload', 'sso-levantamento-documentos', 'sso_autorizar_upload_documento_levantamento', true),
  ('s178_documento_upload_restrito', 'sso-levantamento-documentos', 'sso_autorizar_upload_documento_levantamento', false)
 ) as p(nome,bucket,helper,permissiva)
 loop
  antiga := case when item.permissiva then
   pg_catalog.format('(bucket_id=%L and owner_id=auth.uid()::text and pcm.%I(name))',item.bucket,item.helper)
   else pg_catalog.format('(bucket_id<>%L or (owner_id=auth.uid()::text and pcm.%I(name)))',item.bucket,item.helper) end;
  antiga := pg_catalog.format('(case when bucket_id=%L then %s else %s end)',
   'sso-retorno-evidencias',case when item.permissiva then 'false' else 'true' end,antiga);
  execute pg_catalog.format('create policy sso_comparar on pg_temp.sso_policy_upload_referencia_1815 for insert to authenticated with check (%s)',antiga);
  select pg_catalog.pg_get_expr(polwithcheck,polrelid) into esperada from pg_catalog.pg_policy where polrelid=referencia and polname='sso_comparar';
  execute 'drop policy sso_comparar on pg_temp.sso_policy_upload_referencia_1815';
  select pg_catalog.pg_get_expr(polwithcheck,polrelid) into atual from pg_catalog.pg_policy
   where polrelid=alvo and polname=item.nome and polcmd='a' and polpermissive=item.permissiva
    and polroles=array[papel]::oid[] and polqual is null;
  if atual is null or atual is distinct from esperada then raise exception 'policy_storage_incompativel: %',item.nome using errcode='55000'; end if;
  nova := case when item.permissiva then
   pg_catalog.format('(bucket_id=%L and owner_id=auth.uid()::text and pcm.sso_predicado_upload_bucket_invocador(bucket_id,name))',item.bucket)
   else pg_catalog.format('(bucket_id<>%L or (owner_id=auth.uid()::text and pcm.sso_predicado_upload_bucket_invocador(bucket_id,name)))',item.bucket) end;
  nova := pg_catalog.format('(case when bucket_id=%L then %s else %s end)',
   'sso-retorno-evidencias',case when item.permissiva then 'false' else 'true' end,nova);
  execute pg_catalog.format('alter policy %I on storage.objects with check (%s)',item.nome,nova);
 end loop;
end;
$migration$;
