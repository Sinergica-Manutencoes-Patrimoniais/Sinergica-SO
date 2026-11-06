-- Preparado, NÃO EXECUTADO: rodar somente em banco isolado com migration futura.
-- Sem envio Auvo; fixtures e todos os efeitos devem ser revertidos.
begin;
set local app.auvo_sync_write = 'true';
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17900000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','materiais-s179@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17900000-0000-0000-0000-000000000001','superadmin','Materiais S179',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17900000-0000-0000-0000-00000000000a','Materiais A',true,'17900000-0000-0000-0000-000000000001'),
 ('17900000-0000-0000-0000-00000000000b','Materiais B',true,'17900000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17900000-0000-0000-0000-000000000001','material.gerir','17900000-0000-0000-0000-00000000000a');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
 ('17900000-0000-0000-0000-000000000011','17900000-0000-0000-0000-00000000000a','OS-S179-A','OS A','preventiva','17900000-0000-0000-0000-000000000001'),
 ('17900000-0000-0000-0000-000000000012','17900000-0000-0000-0000-00000000000b','OS-S179-B','OS B','preventiva','17900000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000101',0,'17900000-0000-0000-0000-000000000021','17900000-0000-0000-0000-000000000011','cliente',E'- 2 tubos\ntexto ambíguo') $$,'criação autorizada');
select is((pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000101',0,'17900000-0000-0000-0000-000000000021','17900000-0000-0000-0000-000000000011','cliente',E'- 2 tubos\ntexto ambíguo')->>'revision')::int,1,'retry idêntico devolve mesma revisão');
select throws_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000101',0,'17900000-0000-0000-0000-000000000021','17900000-0000-0000-0000-000000000011','cliente','texto diferente') $$,'23505',null,'requestId não aceita outro texto');
select throws_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000102',0,'17900000-0000-0000-0000-000000000022','17900000-0000-0000-0000-000000000012','cliente','material') $$,'42501',null,'OS de Cliente sem concessão é recusada');
select throws_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000103',0,'17900000-0000-0000-0000-000000000023','17900000-0000-0000-0000-000000000011','cliente',' ') $$,'22023',null,'texto vazio é recusado');
select throws_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000104',1,'17900000-0000-0000-0000-000000000023','17900000-0000-0000-0000-000000000011','cliente','material') $$,'22023',null,'criação exige revisão zero');
select throws_ok($$ insert into pcm.listas_materiais(id) values ('17900000-0000-0000-0000-000000000024') $$,'42501',null,'escrita direta é negada');
reset role;
select is((select texto_original from pcm.listas_materiais where id='17900000-0000-0000-0000-000000000021'),E'- 2 tubos\ntexto ambíguo','texto original é preservado');
select is((select count(*)::int from pcm.listas_materiais where id='17900000-0000-0000-0000-000000000021'),1,'retry não duplica lista');
select is((select count(*)::int from audit.events where entity_id='17900000-0000-0000-0000-000000000021'),1,'auditoria única após retry');
update config.sso_concessoes set ativa=false where usuario_id='17900000-0000-0000-0000-000000000001' and acao='material.gerir';
set local role authenticated;
select throws_ok($$ select pcm.sso_registrar_lista_materiais('17900000-0000-0000-0000-000000000101',0,'17900000-0000-0000-0000-000000000021','17900000-0000-0000-0000-000000000011','cliente',E'- 2 tubos\ntexto ambíguo') $$,'42501',null,'retry após revogação é negado');
select is((select count(*)::int from pcm.listas_materiais),0,'revogação impede leitura');
reset role;
select * from finish();
rollback;
