begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(12);
select has_function('pcm','sso_propor_intencao_os_mediada',array['uuid','uuid','uuid','uuid','uuid','integer','integer','text'],'entrada mediada de intenção existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17198000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intencao-171@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17198000-0000-4000-8000-000000000001','superadmin','Operador sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('17198000-0000-4000-8000-000000000002','Cliente A','17198000-0000-4000-8000-000000000001'),
('17198000-0000-4000-8000-000000000003','Cliente B','17198000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17198000-0000-4000-8000-000000000001','visita.confirmar','17198000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values
('17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','confirmada','17198000-0000-4000-8000-000000000001'),
('17198000-0000-4000-8000-000000000012','17198000-0000-4000-8000-000000000002','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','planejada','17198000-0000-4000-8000-000000000001'),
('17198000-0000-4000-8000-000000000013','17198000-0000-4000-8000-000000000003','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','planejada','17198000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values
('17198000-0000-4000-8000-000000000014','17198000-0000-4000-8000-000000000002','S171-I','OS sintética','corretiva',123987,'17198000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values
('17198000-0000-4000-8000-000000000015','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000014','17198000-0000-4000-8000-000000000002',1,'17198000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"17198000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_propor_intencao_os_mediada('17198000-0000-4000-8000-000000000021','17198000-0000-4000-8000-000000000022','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000012','17198000-0000-4000-8000-000000000015',1,1,'Reprogramar')$$,'55000','reprogramacao_enviada_bloqueada','gate fechado recusa criação');
reset role;
update pcm.reprogramacao_os_enviada_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_propor_intencao_os_mediada('17198000-0000-4000-8000-000000000023','17198000-0000-4000-8000-000000000024','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000013','17198000-0000-4000-8000-000000000015',1,1,'Reprogramar')$$,'42501','visita_nao_encontrada_ou_sem_acesso','destino de outro Cliente negado');
select is(pcm.sso_propor_intencao_os_mediada('17198000-0000-4000-8000-000000000021','17198000-0000-4000-8000-000000000022','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000012','17198000-0000-4000-8000-000000000015',1,1,'Reprogramar')->>'efeitoRemoto','false','intenção não altera tarefa remota');
select is(pcm.sso_propor_intencao_os_mediada('17198000-0000-4000-8000-000000000021','17198000-0000-4000-8000-000000000022','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000012','17198000-0000-4000-8000-000000000015',1,1,'Reprogramar')->>'intencaoId','17198000-0000-4000-8000-000000000022','replay preserva intenção');
select throws_ok($$select pcm.sso_propor_intencao_os_mediada('17198000-0000-4000-8000-000000000021','17198000-0000-4000-8000-000000000022','17198000-0000-4000-8000-000000000011','17198000-0000-4000-8000-000000000012','17198000-0000-4000-8000-000000000015',1,1,'Outro motivo')$$,'23505','request_id_conflitante','payload divergente recusado');
select is((select count(*)::integer from pcm.sso_listar_intencoes_os_mediada('17198000-0000-4000-8000-000000000002',null,30)),1,'lista somente Cliente autorizado');
select throws_ok($$select * from pcm.sso_listar_intencoes_os_mediada('17198000-0000-4000-8000-000000000003',null,30)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','outro Cliente não listado');
reset role;
select is((select count(*)::integer from pcm.reprogramacao_os_intencoes where os_id='17198000-0000-4000-8000-000000000014'),1,'intenção não duplicada');
select is((select visita_id from pcm.visita_ordens_servico where id='17198000-0000-4000-8000-000000000015'),'17198000-0000-4000-8000-000000000011'::uuid,'vínculo original permanece');
select ok(not has_function_privilege('authenticated','pcm.sso_propor_reprogramacao_os_enviada(uuid,uuid,uuid,uuid,uuid,integer,integer,text)','execute') and not has_function_privilege('anon','pcm.sso_propor_intencao_os_mediada(uuid,uuid,uuid,uuid,uuid,integer,integer,text)','execute'),'núcleo e mediadora negam acesso indevido');
update config.sso_concessoes set ativa=false where usuario_id='17198000-0000-4000-8000-000000000001' and acao='visita.confirmar';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_intencoes_os_mediada('17198000-0000-4000-8000-000000000002',null,30)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','revogação impede leitura');
reset role;
select * from finish();
rollback;
