begin;
select plan(15);
set local app.auvo_sync_write='true';
create temporary table s172_vinculo_outbox_antes as select count(*) as total from pcm.auvo_sync_outbox;
select ok(not has_function_privilege('authenticated','pcm.sso_declarar_vinculo_intervalo(uuid,uuid,uuid,uuid,integer,integer,boolean,text)','execute'),'comando ainda sem concessão pública');
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo(null,null,null,null,null,null,null,null)$$,'55000','vinculo_intervalo_bloqueado','gate fechado');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('17297000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s172-vinculo@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17297000-0000-4000-8000-000000000001','superadmin','Vínculo sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17297000-0000-4000-8000-000000000002','Cliente A',true,'17297000-0000-4000-8000-000000000001'),
 ('17297000-0000-4000-8000-000000000003','Cliente B',true,'17297000-0000-4000-8000-000000000001');
insert into pcm.funcionarios(id,nome,ativo) values('17297000-0000-4000-8000-000000000004','Técnico sintético',true);
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17297000-0000-4000-8000-000000000001','capacidade.gerir','17297000-0000-4000-8000-000000000002');
insert into pcm.capacidade_disponibilidades(id,cliente_id,funcionario_id,semana_inicio,destinados_minutos,reservas_minutos,ausencias_minutos,created_by,updated_by) values
 ('17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000004','2026-10-26',600,60,30,'17297000-0000-4000-8000-000000000001','17297000-0000-4000-8000-000000000001'),
 ('17297000-0000-4000-8000-000000000006','17297000-0000-4000-8000-000000000003','17297000-0000-4000-8000-000000000004','2026-10-26',600,60,30,'17297000-0000-4000-8000-000000000001','17297000-0000-4000-8000-000000000001');
insert into pcm.capacidade_intervalos_declarados(id,disponibilidade_id,revisao_disponibilidade,tipo,inicio,fim,fuso,referencia,request_id,ator_id) values
 ('17297000-0000-4000-8000-000000000007','17297000-0000-4000-8000-000000000005',1,'reserva','2026-10-26 10:00Z','2026-10-26 11:00Z','UTC','origem','17297000-0000-4000-8000-000000000008','17297000-0000-4000-8000-000000000001'),
 ('17297000-0000-4000-8000-000000000009','17297000-0000-4000-8000-000000000006',1,'reserva','2026-10-26 10:00Z','2026-10-26 11:00Z','UTC','origem','17297000-0000-4000-8000-000000000010','17297000-0000-4000-8000-000000000001');
update pcm.capacidade_vinculo_intervalo_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17297000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is(pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000011','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,0,true,'informado')->>'coberturaComprovada','false','não afirma cobertura');
select is(pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000011','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,0,true,'informado')->>'revision','1','replay idempotente');
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000011','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,0,false,'informado')$$,'23505','request_id_conflitante','replay divergente negado');
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000012','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000009',1,0,true,'informado')$$,'42501','vinculo_intervalo_sem_acesso','intervalo de outro Cliente negado');
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000012','17297000-0000-4000-8000-000000000003','17297000-0000-4000-8000-000000000006','17297000-0000-4000-8000-000000000009',1,0,true,'informado')$$,'42501','vinculo_intervalo_sem_acesso','Cliente sem concessão negado');
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000012','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,0,true,'informado')$$,'40001','revisao_vinculo_obsoleta','edição concorrente negada');
select is(pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000012','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,1,false,'correção')->>'revision','2','retificação preserva eventos');
select is((select reservas_minutos from pcm.capacidade_disponibilidades where id='17297000-0000-4000-8000-000000000005'),60,'total não foi alterado');
select is((select count(*) from audit.events where entity_id='17297000-0000-4000-8000-000000000005' and action='capacidade.vinculo_intervalo_declarado'),2::bigint,'ações auditadas sem duplicar replay');
select throws_ok($$delete from pcm.capacidade_vinculo_intervalo_eventos where request_id='17297000-0000-4000-8000-000000000011'$$,'23514','intervalo_imutavel','histórico imutável');
update pcm.capacidade_disponibilidades set revisao=2 where id='17297000-0000-4000-8000-000000000005';
select throws_ok($$select pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000013','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,2,true,'informado')$$,'40001','revisao_disponibilidade_obsoleta','não vincula revisão antiga');
select is(pcm.sso_declarar_vinculo_intervalo('17297000-0000-4000-8000-000000000011','17297000-0000-4000-8000-000000000002','17297000-0000-4000-8000-000000000005','17297000-0000-4000-8000-000000000007',1,0,true,'informado')->>'revision','1','replay histórico não cria nova associação');
select is((select count(*) from pcm.auvo_sync_outbox),(select total from s172_vinculo_outbox_antes),'nenhuma fixture enfileira Auvo');
select * from finish();
rollback;
