begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(8);
select has_function('pcm','sso_consultar_identidade_transferencia',array['uuid','uuid','uuid'],'consulta de identidade existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17195000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','identidade-171@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17195000-0000-4000-8000-000000000001','superadmin','Operador sintético',true);
insert into pcm.clientes(id,nome,created_by) values('17195000-0000-4000-8000-000000000002','Cliente A','17195000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17195000-0000-4000-8000-000000000001','visita.confirmar','17195000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values
('17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','enviada','17195000-0000-4000-8000-000000000001'),
('17195000-0000-4000-8000-000000000012','17195000-0000-4000-8000-000000000002','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','planejada','17195000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values('17195000-0000-4000-8000-000000000014','17195000-0000-4000-8000-000000000002','S171-ID','OS sintética','corretiva',123950,'17195000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values('17195000-0000-4000-8000-000000000015','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000014','17195000-0000-4000-8000-000000000002',1,'17195000-0000-4000-8000-000000000001');
update pcm.reprogramacao_os_enviada_gate set habilitado=true where id;
update pcm.transferencia_visita_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17195000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(pcm.sso_consultar_identidade_transferencia('17195000-0000-4000-8000-000000000002','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000015')->>'tarefaAuvoId','123950','mostra identidade local conferível');
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17195000-0000-4000-8000-000000000021','17195000-0000-4000-8000-000000000022','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000012','17195000-0000-4000-8000-000000000015','17195000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123949')$$,'40001','identidade_tarefa_alterada','identidade divergente bloqueia');
reset role;
select ok((select encerrado_em is null from pcm.visita_ordens_servico where id='17195000-0000-4000-8000-000000000015'),'recusa preserva vínculo');
set local role authenticated;
select is(pcm.sso_transferir_os_enviada_conferida('17195000-0000-4000-8000-000000000021','17195000-0000-4000-8000-000000000022','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000012','17195000-0000-4000-8000-000000000015','17195000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123950')->>'tarefaAuvoId','123950','transfere somente tarefa conferida');
select is(pcm.sso_transferir_os_enviada_conferida('17195000-0000-4000-8000-000000000021','17195000-0000-4000-8000-000000000022','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000012','17195000-0000-4000-8000-000000000015','17195000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123950')->>'tarefaAuvoId','123950','replay continua idempotente');
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17195000-0000-4000-8000-000000000021','17195000-0000-4000-8000-000000000022','17195000-0000-4000-8000-000000000011','17195000-0000-4000-8000-000000000012','17195000-0000-4000-8000-000000000015','17195000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123949')$$,'23505','request_id_conflitante','replay divergente recusado');
reset role;
select ok(not has_function_privilege('authenticated','pcm.sso_transferir_os_enviada_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text)','execute'),'entrada sem identidade continua privada');
select * from finish();
rollback;
