-- Banco descartável. Clones temporários neutralizam gate apenas neles; rollback integral.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(8);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16795001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-encerrar@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16795001-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16795001-0000-4000-8000-00000000000a','Cliente A','16795001-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16795001-0000-4000-8000-000000000001','chamado.encerrar','16795001-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16795001-0000-4000-8000-000000000011','CH-S167-FECHAR','16795001-0000-4000-8000-00000000000a','Chamado A','16795001-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values
 ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-00000000000a','ignorado','OS direta','corretiva','finalizado','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000011'),
 ('16795001-0000-4000-8000-000000000022','16795001-0000-4000-8000-00000000000a','OS-S167-FECHAR','OS legada','corretiva','em_execucao','16795001-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16795001-0000-4000-8000-000000000022' where id='16795001-0000-4000-8000-000000000011';
insert into pcm.chamado_escopo_composicoes(chamado_id,declarada_completa) values ('16795001-0000-4000-8000-000000000011',true);
insert into pcm.chamado_escopo_parcelas(id,chamado_id,descricao,situacao,created_by,os_atendimento_id) values ('16795001-0000-4000-8000-000000000031','16795001-0000-4000-8000-000000000011','Parcela','atendida','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000021');
select set_config('request.jwt.claims','{"sub":"16795001-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
create temp table s167_revisao as select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011';
update pcm.chamados set status='cancelado' where id='16795001-0000-4000-8000-000000000011';
select lives_ok($$update pcm.chamados set ordem_servico_id=null where id='16795001-0000-4000-8000-000000000011'$$,'gate fechado preserva escrita legada');
select lives_ok($$update pcm.chamados set ordem_servico_id='16795001-0000-4000-8000-000000000022' where id='16795001-0000-4000-8000-000000000011'$$,'reproduz vínculo depois do cancelamento sem proteção');
update pcm.sso_guarda_cancelado_gate set habilitado=true where id;
select throws_ok($$update pcm.chamados set ordem_servico_id=null where id='16795001-0000-4000-8000-000000000011'$$,'23514','chamado_cancelado_requer_tratamento_formal','referência unilateral protegida');
select throws_ok($$update pcm.ordens_servico set chamado_id=null where id='16795001-0000-4000-8000-000000000021'$$,'23514','chamado_cancelado_requer_tratamento_formal','vínculo direto protegido');
select throws_ok($$insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values ('16795001-0000-4000-8000-000000000023','16795001-0000-4000-8000-00000000000a','ignorado','OS nova','corretiva','em_execucao','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000011')$$,'23514','chamado_cancelado_requer_tratamento_formal','vínculo novo direto rejeitado');
select lives_ok($$update pcm.ordens_servico set status='finalizado' where id='16795001-0000-4000-8000-000000000022'$$,'finalização não é bloqueada');
select ok(not has_table_privilege('authenticated','pcm.sso_guarda_cancelado_gate','update'),'gate privado sem escrita autenticada');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-000000000022','16795001-0000-4000-8000-000000000023')),0,'nenhuma intenção Auvo');
select * from finish();
rollback;
