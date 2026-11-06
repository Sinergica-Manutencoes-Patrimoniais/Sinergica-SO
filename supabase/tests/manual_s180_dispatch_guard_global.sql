-- Experimento em base descartável, somente metadados sintéticos. Não é migration.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir ../migrations/0996_E01-S180_dispatch_storage_experimental.sql
select plan(14);
set local request.jwt.claims='{"sub":"18098000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
create function pcm.sso_teste_dispatch_guard(p_bucket text,p_nome text,p_owner text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 return pcm.sso_s180_dispatch_storage_experimental(p_bucket,p_nome,p_owner);
end $$;
revoke all on function pcm.sso_teste_dispatch_guard(text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_teste_dispatch_guard(text,text,text) to authenticated;
alter policy s180_upload_comprovante on storage.objects with check (bucket_id='sso-despesas-visita' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s180_limitar_upload_comprovante on storage.objects with check (bucket_id<>'sso-despesas-visita' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s176_foto_upload on storage.objects with check (bucket_id='sso-grupos-fotos' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s176_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-grupos-fotos' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s179_evidencia_upload on storage.objects with check (bucket_id='sso-material-evidencias' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s179_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-material-evidencias' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s178_foto_upload on storage.objects with check (bucket_id='sso-levantamento-fotos' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s178_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-fotos' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s178_documento_upload on storage.objects with check (bucket_id='sso-levantamento-documentos' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s178_documento_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-documentos' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s168_evidencia_upload on storage.objects with check (bucket_id='sso-retorno-evidencias' and pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
alter policy s168_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-retorno-evidencias' or pcm.sso_teste_dispatch_guard(bucket_id,name,owner_id));
-- A guarda é acessada por wrapper experimental com EXECUTE apenas no teste.
create function pcm.sso_teste_guard_storage(p_bucket text) returns boolean
language sql stable security definer set search_path='' as $$
 select pcm.sso_s180_guard_storage_experimental(p_bucket)
$$;
revoke all on function pcm.sso_teste_guard_storage(text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_teste_guard_storage(text) to authenticated;
create policy s180_teste_restritiva_global on storage.objects as restrictive for insert to authenticated with check (pcm.sso_teste_guard_storage(bucket_id));
set local role authenticated;
select throws_ok(format('insert into storage.objects(id,bucket_id,name,owner_id) values (%L,%L,%L,%L)', id, bucket, 'diagnostico/arquivo', '18098000-0000-4000-8000-000000000001'), '42501', null, 'ACL revogada mantém negação: ' || bucket)
from (values
 ('18098000-0000-4000-8000-000000000011','sso-despesas-visita'),
 ('18098000-0000-4000-8000-000000000012','sso-grupos-fotos'),
 ('18098000-0000-4000-8000-000000000013','sso-material-evidencias'),
 ('18098000-0000-4000-8000-000000000014','sso-levantamento-fotos'),
 ('18098000-0000-4000-8000-000000000015','sso-levantamento-documentos'),
 ('18098000-0000-4000-8000-000000000016','sso-retorno-evidencias'),
 ('18098000-0000-4000-8000-000000000017','atendimento-midias'),
 ('18098000-0000-4000-8000-000000000018','financeiro-comprovantes')
) t(id,bucket);
reset role;
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='s184_comprovante_insercao_atual' and permissive='RESTRICTIVE'), 'restritiva S184 preservada');
\ir E01-S168_finalizacao_fixture_real.sql
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16891000-0000-4000-8000-000000000001','despesa_visita.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values ('16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','16891000-0000-4000-8000-000000000001');
insert into pcm.despesa_tipos(id,auvo_id,nome) values ('16891000-0000-4000-8000-000000000053',-16891001,'Helper despesa');
insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,created_by) values ('16891000-0000-4000-8000-000000000054','16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000053','2026-11-01','Despesa sintética',100,'16891000-0000-4000-8000-000000000001');
grant execute on function pcm.sso_autorizar_upload_comprovante(text) to authenticated;
update pcm.sso_upload_comprovante_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000066','sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099','16891000-0000-4000-8000-000000000001')$$,'despesa permitida com ACL parcial e gate aberto');
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000067','atendimento-midias','diagnostico/arquivo','16891000-0000-4000-8000-000000000001')$$,'42501',null,'ACL parcial não libera bucket legado');
reset role;
update pcm.sso_upload_comprovante_gate set habilitado=false where id;
set local role authenticated;
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000068','sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000098','16891000-0000-4000-8000-000000000001')$$,'42501',null,'gate fechado impede comprovante');
reset role;
grant execute on function pcm.sso_autorizar_upload_foto_grupo(text),pcm.sso_autorizar_upload_evidencia_material(text),pcm.sso_autorizar_upload_foto_levantamento(text),pcm.sso_autorizar_upload_documento_levantamento(text),pcm.sso_autorizar_upload_evidencia_resposta(text) to authenticated;
set local role authenticated;
select lives_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000070','financeiro-comprovantes','sintetico/permitido','16891000-0000-4000-8000-000000000001')$$,'S184 permite Financeiro com usuário ativo e ACLs abertas');
reset role;
update config.usuarios set ativo=false where user_id='16891000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000071','financeiro-comprovantes','sintetico/negado','16891000-0000-4000-8000-000000000001')$$,'42501',null,'S184 nega usuário desativado mesmo com JWT superadmin');
reset role;
select * from finish();
rollback;
