-- Teste sintético isolado; todos os registros são revertidos.
begin;
set local app.auvo_sync_write = 'true';
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18130000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vinculo-181@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18130000-0000-0000-0000-000000000001','superadmin','Teste vínculo',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18130000-0000-0000-0000-00000000000a','Cliente A sintético',true,'18130000-0000-0000-0000-000000000001'),
 ('18130000-0000-0000-0000-00000000000b','Cliente B sintético',true,'18130000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor) values ('18130000-0000-0000-0000-000000000010','Etapa S181 vínculo',913,'#123456');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values
 ('18130000-0000-0000-0000-000000000011','18130000-0000-0000-0000-00000000000a','18130000-0000-0000-0000-000000000010','Oportunidade A');
insert into pcm.inspecoes(id,client_id,titulo,created_by) values
 ('18130000-0000-0000-0000-000000000021','18130000-0000-0000-0000-00000000000a','Inspeção A','18130000-0000-0000-0000-000000000001'),
 ('18130000-0000-0000-0000-000000000022','18130000-0000-0000-0000-00000000000b','Inspeção B','18130000-0000-0000-0000-000000000001');
insert into comercial.propostas(id,oportunidade_id,tipo) values ('18130000-0000-0000-0000-000000000031','18130000-0000-0000-0000-000000000011','simples');
set local request.jwt.claims = '{"sub":"18130000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$ update comercial.propostas set assessment_id='18130000-0000-0000-0000-000000000021' where id='18130000-0000-0000-0000-000000000031' $$,'vínculo do mesmo Cliente é permitido');
select throws_ok($$ update comercial.propostas set assessment_id='18130000-0000-0000-0000-000000000022' where id='18130000-0000-0000-0000-000000000031' $$,'23514',null,'inspeção de outro Cliente é recusada');
reset role;
select is((select assessment_id from comercial.propostas where id='18130000-0000-0000-0000-000000000031'),'18130000-0000-0000-0000-000000000021'::uuid,'vínculo válido permanece');
select throws_ok($$ update pcm.inspecoes set client_id='18130000-0000-0000-0000-00000000000b' where id='18130000-0000-0000-0000-000000000021' $$,'23514',null,'inspeção vinculada não muda de Cliente');
select throws_ok($$ update comercial.oportunidades set cliente_id='18130000-0000-0000-0000-00000000000b' where id='18130000-0000-0000-0000-000000000011' $$,'23514',null,'oportunidade vinculada não muda de Cliente');
select is((select count(*)::int from pcm.inspecoes where id in ('18130000-0000-0000-0000-000000000021','18130000-0000-0000-0000-000000000022')),2,'inspeções existentes permanecem');
select lives_ok($$ update comercial.propostas set assessment_id=assessment_id where id='18130000-0000-0000-0000-000000000031' $$,'atualização sem alterar vínculo permanece compatível');
select lives_ok($$ update comercial.propostas set assessment_id=null where id='18130000-0000-0000-0000-000000000031' $$,'desvinculação é permitida');
select lives_ok($$ update comercial.oportunidades set cliente_id='18130000-0000-0000-0000-00000000000b' where id='18130000-0000-0000-0000-000000000011' $$,'cliente pode mudar depois da desvinculação');
select * from finish();
rollback;
