-- Somente banco isolado. Nenhum arquivo real é enviado; tudo é revertido.
begin;
set local app.auvo_sync_write = 'true';
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17820000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-gate-objeto@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17820000-0000-0000-0000-000000000001','colaborador','S178 gate',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17820000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17820000-0000-0000-0000-00000000000a','Gate A',true,'17820000-0000-0000-0000-000000000001'),
 ('17820000-0000-0000-0000-00000000000b','Gate B',true,'17820000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17820000-0000-0000-0000-000000000001','cadastro.gerir','17820000-0000-0000-0000-00000000000a'),
 ('17820000-0000-0000-0000-000000000001','cadastro.aprovar','17820000-0000-0000-0000-00000000000a');
insert into pcm.sso_quarentena_csv_lotes(id,request_id,cliente_id,chave_origem,ator_id,payload) values
 ('17820000-0000-0000-0000-00000000010a','17820000-0000-0000-0000-00000000020a','17820000-0000-0000-0000-00000000000a','gate-a','17820000-0000-0000-0000-000000000001','{}'),
 ('17820000-0000-0000-0000-00000000010b','17820000-0000-0000-0000-00000000020b','17820000-0000-0000-0000-00000000000b','gate-b','17820000-0000-0000-0000-000000000001','{}');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values
 ('17820000-0000-0000-0000-00000000030a','17820000-0000-0000-0000-00000000000a','manual','gate-a','[]','17820000-0000-0000-0000-000000000001'),
 ('17820000-0000-0000-0000-00000000030b','17820000-0000-0000-0000-00000000000b','manual','gate-b','[]','17820000-0000-0000-0000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values
 ('17820000-0000-0000-0000-00000000030a','a','area','{}'),('17820000-0000-0000-0000-00000000030b','a','area','{}');
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values
 ('17820000-0000-0000-0000-00000000040a','17820000-0000-0000-0000-00000000000a','17820000-0000-0000-0000-00000000030a','a','17820000-0000-0000-0000-00000000050a','17820000-0000-0000-0000-000000000001','17820000-0000-0000-0000-00000000060a'),
 ('17820000-0000-0000-0000-00000000040b','17820000-0000-0000-0000-00000000000b','17820000-0000-0000-0000-00000000030b','a','17820000-0000-0000-0000-00000000050b','17820000-0000-0000-0000-000000000001','17820000-0000-0000-0000-00000000060b');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17820000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select * from pcm.sso_linhas_quarentena_autorizadas('17820000-0000-0000-0000-00000000010b',null,10)$$,'55000','conferencia_desabilitada','quarentena existente com gate fechado');
select throws_ok($$select * from pcm.sso_linhas_quarentena_autorizadas('17820000-0000-0000-0000-000000000999',null,10)$$,'55000','conferencia_desabilitada','quarentena ausente com gate fechado');
select throws_ok($$select * from pcm.sso_decisoes_foto_autorizadas('17820000-0000-0000-0000-00000000040b',null,10)$$,'55000','conferencia_desabilitada','foto existente com gate fechado');
select throws_ok($$select * from pcm.sso_decisoes_foto_autorizadas('17820000-0000-0000-0000-000000000999',null,10)$$,'55000','conferencia_desabilitada','foto ausente com gate fechado');
reset role;
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
update pcm.sso_quarentena_csv_gate set habilitado=true where id;
update pcm.sso_correcao_quarentena_csv_gate set habilitado=true where id;
update pcm.sso_decisao_foto_levantamento_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_linhas_quarentena_autorizadas('17820000-0000-0000-0000-00000000010b',null,10)$$,'42501','sem_acesso','quarentena de outro Cliente');
select throws_ok($$select * from pcm.sso_linhas_quarentena_autorizadas('17820000-0000-0000-0000-000000000999',null,10)$$,'42501','sem_acesso','quarentena ausente com gate aberto');
select throws_ok($$select * from pcm.sso_decisoes_foto_autorizadas('17820000-0000-0000-0000-00000000040b',null,10)$$,'42501','sem_acesso','foto de outro Cliente');
select throws_ok($$select * from pcm.sso_decisoes_foto_autorizadas('17820000-0000-0000-0000-000000000999',null,10)$$,'42501','sem_acesso','foto ausente com gate aberto');
select lives_ok($$select * from pcm.sso_linhas_quarentena_autorizadas('17820000-0000-0000-0000-00000000010a',null,10)$$,'quarentena autorizada');
select lives_ok($$select * from pcm.sso_decisoes_foto_autorizadas('17820000-0000-0000-0000-00000000040a',null,10)$$,'foto autorizada');
select throws_ok($$select pcm.sso_exigir_quarentena_mediada('17820000-0000-0000-0000-00000000010a')$$,'42501',null,'helper de quarentena privado');
select throws_ok($$select pcm.sso_exigir_evidencia_mediada('foto','17820000-0000-0000-0000-00000000040a')$$,'42501',null,'helper de evidência privado');
reset role;
select * from finish();
rollback;
