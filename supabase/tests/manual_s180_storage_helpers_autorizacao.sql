-- Somente banco descartável e isolado; sem grants aos helpers nem bytes em Storage.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir ../migrations/0966_E01-S180_mediacao_upload_comprovante.sql
\ir E01-S168_finalizacao_fixture_real.sql
select plan(49);
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16891000-0000-4000-8000-000000000001','cadastro.gerir','16891000-0000-4000-8000-000000000002'),
 ('16891000-0000-4000-8000-000000000001','cadastro.aprovar','16891000-0000-4000-8000-000000000002'),
 ('16891000-0000-4000-8000-000000000001','material.gerir','16891000-0000-4000-8000-000000000002'),
 ('16891000-0000-4000-8000-000000000001','despesa_visita.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values ('16891000-0000-4000-8000-000000000050','16891000-0000-4000-8000-000000000002','manual','helper-staging','[]','16891000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,criado_por) values ('16891000-0000-4000-8000-000000000051','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000017','sinergica','Texto sintético','16891000-0000-4000-8000-000000000001');
insert into pcm.sso_lista_materiais_eventos(lista_id,revisao,tipo,dados,ator_id) values ('16891000-0000-4000-8000-000000000051',2,'excecao','{}','16891000-0000-4000-8000-000000000001');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values ('16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','16891000-0000-4000-8000-000000000001');
insert into pcm.despesa_tipos(id,auvo_id,nome) values ('16891000-0000-4000-8000-000000000053',-16891001,'Helper despesa');
insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,created_by) values ('16891000-0000-4000-8000-000000000054','16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000053','2026-11-01','Despesa sintética',100,'16891000-0000-4000-8000-000000000001');
update pcm.sso_grupo_fotos_gate set habilitado=true where id;
update pcm.sso_material_evidencia_gate set habilitado=true where id;
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
update pcm.sso_documentos_levantamento_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_upload_comprovante_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- Execução como owner, apenas para testar predicado sem conceder EXECUTE a authenticated.
select is(pcm.sso_autorizar_upload_foto_grupo('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),true,'grupo permitido');
select is(pcm.sso_autorizar_upload_evidencia_material('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),true,'material permitido');
select is(pcm.sso_autorizar_upload_foto_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),true,'foto levantamento permitida');
select is(pcm.sso_autorizar_upload_documento_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),true,'documento levantamento permitido');
select is(pcm.sso_autorizar_upload_evidencia_resposta('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),true,'evidência resposta permitida');
select is(pcm.sso_autorizar_upload_comprovante('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099'),true,'comprovante permitido');
select is(pcm.sso_autorizar_upload_foto_grupo('invalido'),false,'grupo rejeita caminho');
select is(pcm.sso_autorizar_upload_evidencia_material('invalido'),false,'material rejeita caminho');
select is(pcm.sso_autorizar_upload_foto_levantamento('invalido'),false,'foto rejeita caminho');
select is(pcm.sso_autorizar_upload_documento_levantamento('invalido'),false,'documento rejeita caminho');
select is(pcm.sso_autorizar_upload_evidencia_resposta('invalido'),false,'resposta rejeita caminho');
select is(pcm.sso_autorizar_upload_comprovante('invalido'),false,'comprovante rejeita caminho');
select is(pcm.sso_autorizar_upload_foto_grupo('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),false,'grupo rejeita outro Cliente');
select is(pcm.sso_autorizar_upload_evidencia_material('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),false,'material rejeita outro Cliente');
select is(pcm.sso_autorizar_upload_foto_levantamento('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'foto rejeita outro Cliente');
select is(pcm.sso_autorizar_upload_documento_levantamento('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'documento rejeita outro Cliente');
select is(pcm.sso_autorizar_upload_evidencia_resposta('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),false,'resposta rejeita outro Cliente');
select is(pcm.sso_autorizar_upload_comprovante('16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099'),false,'comprovante rejeita outro Cliente');
update config.usuarios set ativo=false where user_id='16891000-0000-4000-8000-000000000001';
select is(pcm.sso_autorizar_upload_foto_grupo('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),false,'revogação grupo');
select is(pcm.sso_autorizar_upload_evidencia_material('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),false,'revogação material');
select is(pcm.sso_autorizar_upload_foto_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'revogação foto');
select is(pcm.sso_autorizar_upload_documento_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'revogação documento');
select is(pcm.sso_autorizar_upload_evidencia_resposta('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),false,'revogação resposta');
select is(pcm.sso_autorizar_upload_comprovante('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099'),false,'revogação comprovante');
update config.usuarios set ativo=true where user_id='16891000-0000-4000-8000-000000000001';
update pcm.sso_grupo_fotos_gate set habilitado=false where id;
update pcm.sso_material_evidencia_gate set habilitado=false where id;
update pcm.sso_fotos_levantamento_gate set habilitado=false where id;
update pcm.sso_documentos_levantamento_gate set habilitado=false where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=false where id;
update pcm.sso_upload_comprovante_gate set habilitado=false where id;
select is(pcm.sso_autorizar_upload_foto_grupo('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),false,'gate grupo fechado');
select is(pcm.sso_autorizar_upload_evidencia_material('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),false,'gate material fechado');
select is(pcm.sso_autorizar_upload_foto_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'gate foto fechado');
select is(pcm.sso_autorizar_upload_documento_levantamento('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),false,'gate documento fechado');
select is(pcm.sso_autorizar_upload_evidencia_resposta('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),false,'gate resposta fechado');
select is(pcm.sso_autorizar_upload_comprovante('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099'),false,'gate comprovante fechado');
-- Experimento de política; nenhuma dessas alterações ou concessões sobrevive ao ROLLBACK.
update pcm.sso_grupo_fotos_gate set habilitado=true where id;
update pcm.sso_material_evidencia_gate set habilitado=true where id;
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
update pcm.sso_documentos_levantamento_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_upload_comprovante_gate set habilitado=true where id;
create function pcm.sso_teste_dispatch_storage(p_bucket text,p_nome text,p_owner text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or p_owner is distinct from auth.uid()::text then return false; end if;
 case p_bucket
 when 'sso-despesas-visita' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_comprovante(text)','execute') and pcm.sso_autorizar_upload_comprovante(p_nome);
 when 'sso-grupos-fotos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_grupo(text)','execute') and pcm.sso_autorizar_upload_foto_grupo(p_nome);
 when 'sso-material-evidencias' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_material(text)','execute') and pcm.sso_autorizar_upload_evidencia_material(p_nome);
 when 'sso-levantamento-fotos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_levantamento(text)','execute') and pcm.sso_autorizar_upload_foto_levantamento(p_nome);
 when 'sso-levantamento-documentos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_documento_levantamento(text)','execute') and pcm.sso_autorizar_upload_documento_levantamento(p_nome);
 when 'sso-retorno-evidencias' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_resposta(text)','execute') and pcm.sso_autorizar_upload_evidencia_resposta(p_nome);
 else return false; end case;
end $$;
revoke all on function pcm.sso_teste_dispatch_storage(text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_teste_dispatch_storage(text,text,text) to authenticated;
alter policy s180_upload_comprovante on storage.objects with check (bucket_id='sso-despesas-visita' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s180_limitar_upload_comprovante on storage.objects with check (bucket_id<>'sso-despesas-visita' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s176_foto_upload on storage.objects with check (bucket_id='sso-grupos-fotos' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s176_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-grupos-fotos' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s179_evidencia_upload on storage.objects with check (bucket_id='sso-material-evidencias' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s179_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-material-evidencias' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s178_foto_upload on storage.objects with check (bucket_id='sso-levantamento-fotos' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s178_foto_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-fotos' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s178_documento_upload on storage.objects with check (bucket_id='sso-levantamento-documentos' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s178_documento_upload_restrito on storage.objects with check (bucket_id<>'sso-levantamento-documentos' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s168_evidencia_upload on storage.objects with check (bucket_id='sso-retorno-evidencias' and pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
alter policy s168_evidencia_upload_restrito on storage.objects with check (bucket_id<>'sso-retorno-evidencias' or pcm.sso_teste_dispatch_storage(bucket_id,name,owner_id));
set local role authenticated;
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values ('16891000-0000-4000-8000-000000000061','sso-grupos-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099','16891000-0000-4000-8000-000000000001')$$,'42501',null,'dispatcher não contorna ACL de helper revogado');
reset role;
-- Grants locais apenas para simular futuros rollouts individuais, revertidos no final.
grant execute on function pcm.sso_autorizar_upload_foto_grupo(text),pcm.sso_autorizar_upload_evidencia_material(text),pcm.sso_autorizar_upload_foto_levantamento(text),pcm.sso_autorizar_upload_documento_levantamento(text),pcm.sso_autorizar_upload_evidencia_resposta(text) to authenticated;
set local role authenticated;
select lives_ok(format('insert into storage.objects(id,bucket_id,name,owner_id) values (%L,%L,%L,%L)', id, bucket, nome, '16891000-0000-4000-8000-000000000001'), 'permitido com gate e ACL: ' || bucket)
from (values
 ('16891000-0000-4000-8000-000000000061','sso-grupos-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000062','sso-material-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000063','sso-levantamento-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000064','sso-levantamento-documentos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000065','sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000066','sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099')
) t(id,bucket,nome);
select throws_ok(format('insert into storage.objects(id,bucket_id,name,owner_id) values (%L,%L,%L,%L)', id, bucket, nome, '16891000-0000-4000-8000-000000000001'), '42501', null, 'outro Cliente negado: ' || bucket)
from (values
 ('16891000-0000-4000-8000-000000000071','sso-grupos-fotos','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000072','sso-material-evidencias','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000073','sso-levantamento-fotos','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000074','sso-levantamento-documentos','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000075','sso-retorno-evidencias','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000076','sso-despesas-visita','16891000-0000-4000-8000-000000000003/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099')
) t(id,bucket,nome);
select throws_ok(format('insert into storage.objects(id,bucket_id,name,owner_id) values (%L,%L,%L,%L)', id, bucket, nome, '16891000-0000-4000-8000-000000000002'), '42501', null, 'outro owner negado: ' || bucket)
from (values
 ('16891000-0000-4000-8000-000000000081','sso-grupos-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000082','sso-material-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000083','sso-levantamento-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000084','sso-levantamento-documentos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000085','sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099'),
 ('16891000-0000-4000-8000-000000000086','sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000099')
) t(id,bucket,nome);
select * from finish();
rollback;
