-- Somente banco descartável: gates, concessões e fixtures são revertidos.
begin;
set local app.auvo_sync_write = 'true';
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17820000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-cancelamento@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17820000-0000-4000-8000-000000000001','colaborador','S178 cancelamento',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17820000-0000-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17820000-0000-4000-8000-00000000000a','Cliente A',true,'17820000-0000-4000-8000-000000000001'),
 ('17820000-0000-4000-8000-00000000000b','Cliente B',true,'17820000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17820000-0000-4000-8000-000000000001','cadastro.aprovar','17820000-0000-4000-8000-00000000000a');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values
 ('17820000-0000-4000-8000-00000000010a','17820000-0000-4000-8000-00000000000a','manual','cancelamento-a','[]','17820000-0000-4000-8000-000000000001'),
 ('17820000-0000-4000-8000-00000000010b','17820000-0000-4000-8000-00000000000b','manual','cancelamento-b','[]','17820000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17820000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-000000000001','17820000-0000-4000-8000-00000000000a','17820000-0000-4000-8000-00000000010a')$$,'55000','cancelamento_desabilitado','gate fechado recusa cancelamento');
reset role;
update pcm.sso_cancelamento_aprovacao_gate set habilitado=true where id;
update pcm.sso_aprovacao_parcial_gate set habilitado=true where id;
update pcm.sso_incorporacao_aprovacao_gate set habilitado=true where id;
-- O núcleo é concedido somente nesta transação para exercitar a guarda.
grant execute on function pcm.sso_aprovar_linhas_parcialmente(uuid,uuid,integer,jsonb,text,boolean) to authenticated;
set local role authenticated;
select throws_ok($$select pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-000000000001','17820000-0000-4000-8000-00000000000b','17820000-0000-4000-8000-00000000010b')$$,'42501',null,'não cancela em outro Cliente');
select throws_ok($$select pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-000000000009','17820000-0000-4000-8000-00000000000a','17820000-0000-4000-8000-00000000010a')$$,'42501',null,'não aceita ator divergente');
select is(pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-000000000001','17820000-0000-4000-8000-00000000000a','17820000-0000-4000-8000-00000000010a')->>'estado','cancelado','cancela tentativa sem comando confirmado');
select is(pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-000000000001','17820000-0000-4000-8000-00000000000a','17820000-0000-4000-8000-00000000010a')->>'estado','cancelado','retry do cancelamento é idempotente');
select throws_ok($$select pcm.sso_aprovar_linhas_parcialmente('17820000-0000-4000-8000-000000000101','17820000-0000-4000-8000-00000000010a',1,'[{"chave":"a","atributos":{},"codigoRevision":0}]','motivo',true)$$,'55000','tentativa_cancelada','pedido tardio não aprova');
reset role;
insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values
 ('17820000-0000-4000-8000-000000000102','17820000-0000-4000-8000-000000000001','{"operacao":"aprovar_linhas_parcialmente","loteId":"17820000-0000-4000-8000-00000000010a"}','{}');
set local role authenticated;
select is(pcm.sso_cancelar_tentativa_aprovacao('17820000-0000-4000-8000-000000000102','17820000-0000-4000-8000-000000000001','17820000-0000-4000-8000-00000000000a','17820000-0000-4000-8000-00000000010a')->>'estado','confirmado','comando existente não é cancelado');
reset role;
select is((select count(*)::integer from pcm.sso_aprovacao_tentativas_canceladas where request_id='17820000-0000-4000-8000-000000000101'),1,'uma marca imutável por request');
select is((select count(*)::integer from pcm.sso_aprovacao_tentativas_canceladas where request_id='17820000-0000-4000-8000-000000000102'),0,'comando confirmado não recebe cancelamento');
select * from finish();
rollback;
