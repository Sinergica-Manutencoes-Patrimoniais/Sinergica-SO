-- E01-S176: fixtures sintéticas, transação revertida. Exige migrations 1796/1797.
begin;
set local app.auvo_sync_write = 'true';
select plan(10);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17690000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vinculos-s176@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17690000-0000-0000-0000-00000000000a','Cliente A S176',true,'17690000-0000-0000-0000-000000000001'),
 ('17690000-0000-0000-0000-00000000000b','Cliente B S176',true,'17690000-0000-0000-0000-000000000001');
insert into pcm.areas(id,cliente_id,nome) values
 ('17690000-0000-0000-0000-000000000021','17690000-0000-0000-0000-00000000000a','Área A');
insert into pcm.locais(id,area_id,nome) values
 ('17690000-0000-0000-0000-000000000031','17690000-0000-0000-0000-000000000021','Local A');
insert into pcm.sistemas(id,cliente_id,nome) values
 ('17690000-0000-0000-0000-000000000051','17690000-0000-0000-0000-00000000000a','Sistema A'),
 ('17690000-0000-0000-0000-000000000052','17690000-0000-0000-0000-00000000000b','Sistema B');
insert into pcm.equipamentos(id,nome,client_id) values
 ('17690000-0000-0000-0000-000000000011','Item A','17690000-0000-0000-0000-00000000000a'),
 ('17690000-0000-0000-0000-000000000012','Item B','17690000-0000-0000-0000-00000000000b'),
 ('17690000-0000-0000-0000-000000000013','Item sem Cliente',null);

select lives_ok($$insert into pcm.sistema_itens(sistema_id,item_id) values('17690000-0000-0000-0000-000000000051','17690000-0000-0000-0000-000000000011')$$,'vínculo do mesmo Cliente é aceito');
select throws_ok($$insert into pcm.sistema_itens(sistema_id,item_id) values('17690000-0000-0000-0000-000000000051','17690000-0000-0000-0000-000000000012')$$,'23514','vinculo_cliente_incompativel','novo vínculo entre Clientes é recusado');
select throws_ok($$insert into pcm.sistema_itens(sistema_id,item_id) values('17690000-0000-0000-0000-000000000051','17690000-0000-0000-0000-000000000013')$$,'23514','vinculo_cliente_incompativel','novo vínculo com Cliente não identificado é recusado');
select throws_ok($$update pcm.sistemas set cliente_id='17690000-0000-0000-0000-00000000000b' where id='17690000-0000-0000-0000-000000000051'$$,'23514',null,'Sistema não abandona Cliente do item vinculado');
select throws_ok($$update pcm.equipamentos set client_id='17690000-0000-0000-0000-00000000000b' where id='17690000-0000-0000-0000-000000000011'$$,'23514',null,'item não abandona Cliente do Sistema vinculado');
select is((select client_id::text from pcm.equipamentos where id='17690000-0000-0000-0000-000000000011'),'17690000-0000-0000-0000-00000000000a','rejeição preserva Cliente e vínculo');
select lives_ok($$update pcm.equipamentos set local_id='17690000-0000-0000-0000-000000000031' where id='17690000-0000-0000-0000-000000000013'$$,'Local deriva Cliente em alteração indireta');
select is((select client_id::text from pcm.equipamentos where id='17690000-0000-0000-0000-000000000013'),'17690000-0000-0000-0000-00000000000a','Cliente final é derivado da Área do Local');
select lives_ok($$delete from pcm.sistema_itens where sistema_id='17690000-0000-0000-0000-000000000051' and item_id='17690000-0000-0000-0000-000000000011'$$,'retirada de vínculo permanece disponível para correção');
select lives_ok($$update pcm.equipamentos set client_id='17690000-0000-0000-0000-00000000000b' where id='17690000-0000-0000-0000-000000000011'$$,'após retirar vínculo item pode mudar de Cliente');
select * from finish();
rollback;
