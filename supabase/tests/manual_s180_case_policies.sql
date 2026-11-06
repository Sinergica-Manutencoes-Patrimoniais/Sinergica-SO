-- Experimento isolado: preserva ACLs e reverte todas as alterações com o teste incluído.
-- Não é migration nem autoriza rollout; também exige revisão de concorrência e segurança.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_setting('sso.teste_isolado',true) is distinct from 'true' or current_setting('cron.launch_active_jobs') <> 'off' then
    raise exception 'ambiente_inadequado';
  end if;
end $$;
alter policy s168_evidencia_upload on storage.objects with check (case when bucket_id='sso-retorno-evidencias' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_resposta(name) else false end);
alter policy s168_evidencia_upload_restrito on storage.objects with check (case when bucket_id='sso-retorno-evidencias' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_resposta(name) else true end);
alter policy s176_foto_upload on storage.objects with check (case when bucket_id='sso-grupos-fotos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_grupo(name) else false end);
alter policy s176_foto_upload_restrito on storage.objects with check (case when bucket_id='sso-grupos-fotos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_grupo(name) else true end);
alter policy s178_documento_upload on storage.objects with check (case when bucket_id='sso-levantamento-documentos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_documento_levantamento(name) else false end);
alter policy s178_documento_upload_restrito on storage.objects with check (case when bucket_id='sso-levantamento-documentos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_documento_levantamento(name) else true end);
alter policy s178_foto_upload on storage.objects with check (case when bucket_id='sso-levantamento-fotos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_levantamento(name) else false end);
alter policy s178_foto_upload_restrito on storage.objects with check (case when bucket_id='sso-levantamento-fotos' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_foto_levantamento(name) else true end);
alter policy s179_evidencia_upload on storage.objects with check (case when bucket_id='sso-material-evidencias' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_material(name) else false end);
alter policy s179_evidencia_upload_restrito on storage.objects with check (case when bucket_id='sso-material-evidencias' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_material(name) else true end);
alter policy s180_upload_comprovante on storage.objects with check (case when bucket_id='sso-despesas-visita' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_comprovante(name) else false end);
alter policy s180_limitar_upload_comprovante on storage.objects with check (case when bucket_id='sso-despesas-visita' then owner_id=auth.uid()::text and pcm.sso_autorizar_upload_comprovante(name) else true end);
\ir E01-S180_mediacao_upload.test.sql
