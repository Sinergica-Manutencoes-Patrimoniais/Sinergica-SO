-- Fixtures sintéticas, sem sincronização Auvo; alterações sempre revertidas.
begin;
set local app.auvo_sync_write = 'true';
select plan(10);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17793000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','codigo-s177@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17793000-0000-0000-0000-000000000001','superadmin','Teste código',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('17793000-0000-0000-0000-00000000000a','Cliente código',true,'17793000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17793000-0000-0000-0000-000000000001','codigo.substituir','17793000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17793000-0000-0000-0000-000000000011','17793000-0000-0000-0000-00000000000a','Sistema sintético','S177-OLD-993');
set local request.jwt.claims = '{"sub":"17793000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$update pcm.sistemas set codigo='S177-FORBIDDEN-993' where id='17793000-0000-0000-0000-000000000011'$$,'42501',null,'alteração comum protegida');
select lives_ok($$select pcm.sso_substituir_codigo_publico('17793000-0000-0000-0000-000000000021','sistema','17793000-0000-0000-0000-000000000011','S177-OLD-993','S177-NEW-993','Correção auditada')$$,'correção excepcional autorizada');
select lives_ok($$select pcm.sso_substituir_codigo_publico('17793000-0000-0000-0000-000000000021','sistema','17793000-0000-0000-0000-000000000011','S177-OLD-993','S177-NEW-993','Correção auditada')$$,'replay idêntico');
select throws_ok($$select pcm.sso_substituir_codigo_publico('17793000-0000-0000-0000-000000000021','sistema','17793000-0000-0000-0000-000000000011','S177-OLD-993','S177-OTHER-993','Correção auditada')$$,'23505',null,'replay divergente recusado');
reset role;
select is((select codigo from pcm.sistemas where id='17793000-0000-0000-0000-000000000011'),'S177-NEW-993','código atual substituído');
select is((select count(*) from pcm.sso_codigo_aliases where sistema_id='17793000-0000-0000-0000-000000000011' and codigo='S177-OLD-993'),1::bigint,'código anterior preservado uma vez');
select is((select count(*) from audit.events where action='codigo.substituido' and entity_id='17793000-0000-0000-0000-000000000011'),1::bigint,'auditoria não duplicada');
select throws_ok($$insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17793000-0000-0000-0000-000000000012','17793000-0000-0000-0000-00000000000a','Colisão','s177-old-993')$$,'23505',null,'alias impede reuso como código público');
update config.sso_concessoes set ativa=false where usuario_id='17793000-0000-0000-0000-000000000001' and acao='codigo.substituir';
set local role authenticated;
select throws_ok($$select pcm.sso_substituir_codigo_publico('17793000-0000-0000-0000-000000000021','sistema','17793000-0000-0000-0000-000000000011','S177-OLD-993','S177-NEW-993','Correção auditada')$$,'42501',null,'replay após revogação recusado');
select throws_ok($$select pcm.sso_substituir_codigo_publico('17793000-0000-0000-0000-000000000022','sistema','17793000-0000-0000-0000-000000000011','S177-NEW-993','S177-OTHER-993','Correção')$$,'42501',null,'nova correção após revogação recusada');
reset role;
select * from finish();
rollback;
