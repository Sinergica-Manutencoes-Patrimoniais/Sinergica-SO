-- Somente clone descartável; não prova Storage HTTP nem permissões do destino.
begin;
do $$ begin
 if not has_function_privilege('authenticated','pcm.sso_predicado_upload_bucket_invocador(text,text)','execute')
  or has_function_privilege('anon','pcm.sso_predicado_upload_bucket_invocador(text,text)','execute')
  or has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_grupo(text)','execute')
  or has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_levantamento(text)','execute')
  or has_function_privilege('authenticated','pcm.sso_autorizar_upload_documento_levantamento(text)','execute') then
  raise exception 'acl_dispatch_divergente';
 end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"18150000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
 if pcm.sso_predicado_upload_bucket_invocador('sso-grupos-fotos','x') is distinct from false
  or pcm.sso_predicado_upload_bucket_invocador('sso-levantamento-fotos','x') is distinct from false
  or pcm.sso_predicado_upload_bucket_invocador('sso-levantamento-documentos','x') is distinct from false
  or pcm.sso_predicado_upload_bucket_invocador('outro','x') is distinct from false then
  raise exception 'dispatcher_nao_fechou';
 end if;
end $$;
reset role;
rollback;
-- Esta fixture inclui setup e rollback próprios e testa o INSERT e negativa de Cliente.
\ir manual_E01-S168_politica_upload_1811.sql
