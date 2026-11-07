begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(16);
select has_function('pcm','sso_triagem_intencao_mediada',array['uuid','uuid','uuid','integer','text','text','text','text','text'],'triagem mediada existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17197000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','triagem-171@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17197000-0000-4000-8000-000000000001','superadmin','Operador sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('17197000-0000-4000-8000-000000000002','Cliente A','17197000-0000-4000-8000-000000000001'),
('17197000-0000-4000-8000-000000000003','Cliente B','17197000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17197000-0000-4000-8000-000000000001','visita.confirmar','17197000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values
('17197000-0000-4000-8000-000000000011','17197000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','confirmada','17197000-0000-4000-8000-000000000001'),
('17197000-0000-4000-8000-000000000012','17197000-0000-4000-8000-000000000002','2026-11-09 12:00+00','2026-11-09 13:00+00','America/Sao_Paulo','extra','planejada','17197000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values('17197000-0000-4000-8000-000000000014','17197000-0000-4000-8000-000000000002','S171-T','OS sintética','corretiva',123976,'17197000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values('17197000-0000-4000-8000-000000000015','17197000-0000-4000-8000-000000000011','17197000-0000-4000-8000-000000000014','17197000-0000-4000-8000-000000000002',1,'17197000-0000-4000-8000-000000000001');
insert into pcm.reprogramacao_os_intencoes(id,cliente_id,os_id,visita_origem_id,visita_destino_id,vinculo_origem_id,revisao_origem,revisao_destino,tarefa_auvo_id,inicio_destino,fim_destino,motivo,request_id,criado_por)
values('17197000-0000-4000-8000-000000000020','17197000-0000-4000-8000-000000000002','17197000-0000-4000-8000-000000000014','17197000-0000-4000-8000-000000000011','17197000-0000-4000-8000-000000000012','17197000-0000-4000-8000-000000000015',1,1,123976,'2026-11-09 12:00+00','2026-11-09 13:00+00','teste','17197000-0000-4000-8000-000000000021','17197000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"17197000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_intencoes_triagem_mediada('17197000-0000-4000-8000-000000000002',null,30)$$,'55000','reprogramacao_enviada_bloqueada','gate fechado impede leitura');
reset role;
update pcm.reprogramacao_os_enviada_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_intencoes_triagem_mediada('17197000-0000-4000-8000-000000000002',null,30)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','exige capacidade de reconciliação');
select throws_ok($$select pcm.sso_triagem_intencao_mediada('17197000-0000-4000-8000-000000000030','17197000-0000-4000-8000-000000000031','17197000-0000-4000-8000-000000000020',1,'anotar','mesma_tarefa','123976','referência','conferido')$$,'42501','intencao_nao_encontrada_ou_sem_acesso','escrita exige ambas capacidades');
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17197000-0000-4000-8000-000000000001','integracao.reconciliar','17197000-0000-4000-8000-000000000002');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
('17197000-0000-4000-8000-000000000001','visita.confirmar','17197000-0000-4000-8000-000000000003'),
('17197000-0000-4000-8000-000000000001','integracao.reconciliar','17197000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::integer from pcm.sso_listar_intencoes_triagem_mediada('17197000-0000-4000-8000-000000000002',null,30)),1,'lista intenção autorizada');
select is((pcm.sso_triagem_intencao_mediada('17197000-0000-4000-8000-000000000030','17197000-0000-4000-8000-000000000031','17197000-0000-4000-8000-000000000020',1,'anotar','mesma_tarefa','123976','referência','conferido')->>'revision')::integer,2,'registra evento versionado');
select is((pcm.sso_triagem_intencao_mediada('17197000-0000-4000-8000-000000000030','17197000-0000-4000-8000-000000000031','17197000-0000-4000-8000-000000000020',1,'anotar','mesma_tarefa','123976','referência','conferido')->>'revision')::integer,2,'replay não duplica');
select throws_ok($$select pcm.sso_triagem_intencao_mediada('17197000-0000-4000-8000-000000000030','17197000-0000-4000-8000-000000000031','17197000-0000-4000-8000-000000000020',1,'anotar','mesma_tarefa','123976','outra','conferido')$$,'23505','request_id_conflitante','replay divergente recusado');
select is((select count(*)::integer from pcm.sso_listar_triagens_mediada('17197000-0000-4000-8000-000000000002','17197000-0000-4000-8000-000000000020',null,30)),1,'histórico mínimo disponível');
select throws_ok($$select * from pcm.sso_listar_triagens_mediada('17197000-0000-4000-8000-000000000003','17197000-0000-4000-8000-000000000020',null,30)$$,'42501','intencao_nao_encontrada_ou_sem_acesso','outro Cliente autorizado não acessa intenção alheia');
reset role;
select is((select count(*)::integer from pcm.reprogramacao_os_intencao_eventos where intencao_id='17197000-0000-4000-8000-000000000020'),1,'somente um evento');
select is((select count(*)::integer from audit.events where action='visita.intencao_triagem' and entity_id='17197000-0000-4000-8000-000000000020'),1,'auditoria não duplicada');
select is((select visita_id from pcm.visita_ordens_servico where id='17197000-0000-4000-8000-000000000015'),'17197000-0000-4000-8000-000000000011'::uuid,'triagem não move OS');
select ok(not has_function_privilege('authenticated','pcm.sso_triagem_intencao_os(uuid,uuid,uuid,integer,text,text,text,text,text)','execute') and not has_function_privilege('anon','pcm.sso_triagem_intencao_mediada(uuid,uuid,uuid,integer,text,text,text,text,text)','execute'),'núcleo e anon sem acesso');
update config.sso_concessoes set ativa=false where usuario_id='17197000-0000-4000-8000-000000000001' and acao='integracao.reconciliar';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_triagens_mediada('17197000-0000-4000-8000-000000000002','17197000-0000-4000-8000-000000000020',null,30)$$,'42501','intencao_nao_encontrada_ou_sem_acesso','revogação impede histórico');
reset role;
update config.sso_concessoes set ativa=(acao='integracao.reconciliar') where usuario_id='17197000-0000-4000-8000-000000000001' and acao in ('visita.confirmar','integracao.reconciliar');
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_intencoes_triagem_mediada('17197000-0000-4000-8000-000000000002',null,30)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','reconciliação isolada sem Visita não autoriza leitura');
reset role;
select * from finish();
rollback;
