-- DIAGNÓSTICO: somente banco descartável isolado. Não envia bytes e reverte TODAS as alterações.
-- A segunda metade suprime temporariamente políticas privadas para demonstrar que
-- retirar helpers do plano de INSERT muda também o comportamento de outros buckets.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(2);
set local request.jwt.claims = '{"sub":"18097000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('18097000-0000-4000-8000-000000000002','atendimento-midias','diagnostico/objeto','18097000-0000-4000-8000-000000000001')$$,'42501',null,'políticas compartilhadas bloqueiam INSERT em bucket legado');
reset role;
-- Simulação diagnóstica, não proposta de política nem permissão de implantação.
alter policy s178_foto_upload on storage.objects with check (false);
alter policy s178_foto_upload_restrito on storage.objects with check (true);
alter policy s176_foto_upload on storage.objects with check (false);
alter policy s176_foto_upload_restrito on storage.objects with check (true);
alter policy s179_evidencia_upload on storage.objects with check (false);
alter policy s179_evidencia_upload_restrito on storage.objects with check (true);
alter policy s178_documento_upload on storage.objects with check (false);
alter policy s178_documento_upload_restrito on storage.objects with check (true);
alter policy s168_evidencia_upload on storage.objects with check (false);
alter policy s168_evidencia_upload_restrito on storage.objects with check (true);
alter policy s180_upload_comprovante on storage.objects with check (false);
alter policy s180_limitar_upload_comprovante on storage.objects with check (true);
set local role authenticated;
select lives_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('18097000-0000-4000-8000-000000000002','atendimento-midias','diagnostico/objeto','18097000-0000-4000-8000-000000000001')$$,'retirar helpers do plano altera efetividade em bucket legado');
select * from finish();
rollback;
