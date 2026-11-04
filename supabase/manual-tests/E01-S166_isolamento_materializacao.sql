-- Executar junto com 1002 em transação REPEATABLE READ, nunca em produção.
-- A guarda deve falhar antes de usar snapshot antigo; dados são revertidos.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16640000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','isolamento-s166@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16640000-0000-0000-0000-000000000001','superadmin','Isolamento S166',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16640000-0000-0000-0000-00000000000a','Cliente sintético',true,'16640000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16640000-0000-0000-0000-000000000001','plano.gerir','16640000-0000-0000-0000-00000000000a');
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16640000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_materializar_ciclo_canonico('16640000-0000-0000-0000-000000000101','16640000-0000-0000-0000-00000000000a','16640000-0000-0000-0000-000000000011','16640000-0000-0000-0000-000000000012','16640000-0000-0000-0000-000000000013',1,current_date)$$,'25001',null,'ciclo canônico recusa isolamento antigo');
select throws_ok($$select pcm.sso_materializar_ciclo_legado('16640000-0000-0000-0000-000000000102','16640000-0000-0000-0000-00000000000a','16640000-0000-0000-0000-000000000014','16640000-0000-0000-0000-000000000015','16640000-0000-0000-0000-000000000016','16640000-0000-0000-0000-000000000017','teste')$$,'25001',null,'ciclo legado recusa isolamento antigo');
select throws_ok($$select pcm.sso_materializar_lote_calendario('16640000-0000-0000-0000-000000000103','16640000-0000-0000-0000-00000000000a','16640000-0000-0000-0000-000000000011','16640000-0000-0000-0000-000000000012','16640000-0000-0000-0000-000000000013',1,current_date,current_date)$$,'25001',null,'lote canônico recusa isolamento antigo');
select throws_ok($$select pcm.sso_materializar_lote_legado('16640000-0000-0000-0000-000000000104','16640000-0000-0000-0000-00000000000a','16640000-0000-0000-0000-000000000011','16640000-0000-0000-0000-000000000015','16640000-0000-0000-0000-000000000016',1,array['16640000-0000-0000-0000-000000000014'::uuid],'teste')$$,'25001',null,'lote legado recusa isolamento antigo');
select * from finish();
rollback;
