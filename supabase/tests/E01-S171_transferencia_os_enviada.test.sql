begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(21);
select has_function('pcm','sso_transferir_os_enviada_conferida',array['uuid','uuid','uuid','uuid','uuid','uuid','integer','integer','integer','text','text'],'transferência de OS enviada existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17196000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','transferencia-171@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17196000-0000-4000-8000-000000000001','superadmin','Operador sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('17196000-0000-4000-8000-000000000002','Cliente A','17196000-0000-4000-8000-000000000001'),
('17196000-0000-4000-8000-000000000003','Cliente B','17196000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17196000-0000-4000-8000-000000000001','visita.confirmar','17196000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values
('17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','enviada','17196000-0000-4000-8000-000000000001'),
('17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000002','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','confirmada','17196000-0000-4000-8000-000000000001'),
('17196000-0000-4000-8000-000000000013','17196000-0000-4000-8000-000000000003','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','planejada','17196000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values('17196000-0000-4000-8000-000000000014','17196000-0000-4000-8000-000000000002','S171-M','OS sintética','corretiva',123965,'17196000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,estimativa_minutos,created_by) values('17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000014','17196000-0000-4000-8000-000000000002',1,90,'17196000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"17196000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123965')$$,'55000','reprogramacao_enviada_bloqueada','gate de intenção fechado bloqueia');
reset role;
update pcm.reprogramacao_os_enviada_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123965')$$,'55000','transferencia_bloqueada','gate de transferência fechado bloqueia');
reset role;
update pcm.transferencia_visita_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000023','17196000-0000-4000-8000-000000000024','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000013','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000017',1,1,1,'Reprogramar','123965')$$,'42501','visita_nao_encontrada_ou_sem_acesso','destino de outro Cliente negado');
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000023','17196000-0000-4000-8000-000000000024','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000017',2,1,1,'Reprogramar','123965')$$,'40001','revisao_obsoleta','revisão divergente recusada');
select is(pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123965')->>'efeitoRemoto','false','transfere localmente sem alteração remota');
select is(pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123965')->>'novoVinculoId','17196000-0000-4000-8000-000000000016','replay devolve mesmo vínculo');
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Outro motivo','123965')$$,'23505','request_id_conflitante','payload divergente recusado');
reset role;
select ok((select encerrado_em is not null and encerramento_motivo='Reprogramar' from pcm.visita_ordens_servico where id='17196000-0000-4000-8000-000000000015'),'vínculo anterior encerrado com motivo');
select is((select visita_id from pcm.visita_ordens_servico where id='17196000-0000-4000-8000-000000000016' and encerrado_em is null),'17196000-0000-4000-8000-000000000012'::uuid,'novo vínculo vigente no destino');
select is((select count(*)::integer from pcm.visita_ordens_servico where os_id='17196000-0000-4000-8000-000000000014' and encerrado_em is null),1,'apenas um vínculo vigente');
select is((select auvo_task_id from pcm.ordens_servico where id='17196000-0000-4000-8000-000000000014'),123965::bigint,'mesma tarefa Auvo preservada');
select is((select estado from pcm.visitas where id='17196000-0000-4000-8000-000000000012'),'planejada','destino confirmado precisa nova confirmação');
select is((select count(*)::integer from pcm.reprogramacao_os_intencoes where id='17196000-0000-4000-8000-000000000022' and estado='pendente'),1,'intenção única pendente');
select is((select count(*)::integer from audit.events where action='visita.os_enviada_transferida' and entity_id='17196000-0000-4000-8000-000000000011'),1,'auditoria única');
select is((select count(*)::integer from net.http_request_queue),0,'nenhum envio HTTP foi enfileirado');
select ok(not has_function_privilege('anon','pcm.sso_transferir_os_enviada_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text)','execute'),'anon não chama comando');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values('17196000-0000-4000-8000-000000000019','17196000-0000-4000-8000-000000000002','S171-M2','Outra OS','corretiva',123964,'17196000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values('17196000-0000-4000-8000-000000000018','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000019','17196000-0000-4000-8000-000000000002',2,'17196000-0000-4000-8000-000000000001');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values('17196000-0000-4000-8000-000000000010','17196000-0000-4000-8000-000000000002','2026-11-16 12:00+00','2026-11-16 13:00+00','America/Sao_Paulo','extra','planejada','17196000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000025','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000010','17196000-0000-4000-8000-000000000018','17196000-0000-4000-8000-000000000017',2,1,2,'Reprogramar','123964')$$,'23505',null,'colisão de intenção reverte operação');
reset role;
select ok((select encerrado_em is null from pcm.visita_ordens_servico where id='17196000-0000-4000-8000-000000000018'),'erro mantém vínculo original');
select is((select count(*)::integer from pcm.visita_ordens_servico where id='17196000-0000-4000-8000-000000000017'),0,'erro não cria vínculo de destino');
update config.sso_concessoes set ativa=false where usuario_id='17196000-0000-4000-8000-000000000001' and acao='visita.confirmar';
set local role authenticated;
select throws_ok($$select pcm.sso_transferir_os_enviada_conferida('17196000-0000-4000-8000-000000000021','17196000-0000-4000-8000-000000000022','17196000-0000-4000-8000-000000000011','17196000-0000-4000-8000-000000000012','17196000-0000-4000-8000-000000000015','17196000-0000-4000-8000-000000000016',1,1,1,'Reprogramar','123965')$$,'42501','visita_nao_encontrada_ou_sem_acesso','replay após revogação não revela resultado');
reset role;
select * from finish();
rollback;
