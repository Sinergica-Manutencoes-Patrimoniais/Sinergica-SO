-- Fixture mínima sintética, transacional, sem integração externa.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17799500-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-recepcao@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17799500-0000-0000-0000-000000000001','superadmin','Recepção sintética',true);
insert into pcm.clientes(id,nome,ativo,created_by) values('17799500-0000-0000-0000-00000000000a','Cliente sintético',true,'17799500-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17799500-0000-0000-0000-000000000001','cadastro.gerir','17799500-0000-0000-0000-00000000000a');
select plan(5);
set local request.jwt.claims='{"sub":"17799500-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$select pcm.sso_receber_levantamento_manual('17799500-0000-0000-0000-000000000044','17799500-0000-0000-0000-00000000000a','planilha','s178-teste-1014','[{"chave":"1","tipo":"sistema","atributos":{"nome":"Sintético"}}]'::jsonb)$$,'recepção autorizada');
select lives_ok($$select pcm.sso_receber_levantamento_manual('17799500-0000-0000-0000-000000000044','17799500-0000-0000-0000-00000000000a','planilha','s178-teste-1014','[{"chave":"1","tipo":"sistema","atributos":{"nome":"Sintético"}}]'::jsonb)$$,'replay idêntico');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17799500-0000-0000-0000-000000000044','17799500-0000-0000-0000-00000000000a','planilha','s178-teste-1014','[{"chave":"1","tipo":"sistema","atributos":{"nome":"Alterado"}}]'::jsonb)$$,'23505',null,'replay divergente recusado');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17799500-0000-0000-0000-000000000045','17799500-0000-0000-0000-000000000099','planilha','s178-teste-1014','[{"chave":"1","tipo":"sistema","atributos":{"nome":"Sintético"}}]'::jsonb)$$,'42501',null,'outro Cliente recusado');
reset role;
select is((select count(*) from pcm.sso_levantamentos where chave_origem='s178-teste-1014'),1::bigint,'replay não duplica lote');
select * from finish();
rollback;
