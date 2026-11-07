-- Apenas clone isolado; nenhuma integração externa e todos os dados revertidos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
set local app.auvo_sync_write='true';
select plan(14);
select has_function('pcm','sso_exigir_agenda_tecnico_capacidade',array[]::text[],'guarda serializada existe');
select is((select provolatile::text from pg_proc where oid='pcm.sso_listar_agenda_tecnico_capacidade(uuid,date,date,uuid,integer)'::regprocedure),'v','leitura usa snapshot atualizado após espera');
select ok(has_function_privilege('authenticated','pcm.sso_exigir_agenda_tecnico_capacidade()','execute') and not has_function_privilege('anon','pcm.sso_exigir_agenda_tecnico_capacidade()','execute') and not has_function_privilege('service_role','pcm.sso_exigir_agenda_tecnico_capacidade()','execute'),'somente authenticated executa guarda');
select ok(not has_table_privilege('authenticated','pcm.capacidade_agenda_tecnico_gate','update') and not has_table_privilege('authenticated','pcm.capacidade_agenda_tecnico_gate','select'),'gate não é acessível diretamente');
create temporary table s172_outbox_antes as select count(*) quantidade from pcm.auvo_sync_outbox;
select throws_ok($$select * from pcm.sso_listar_agenda_tecnico_capacidade(null,null,null,null,50)$$,'55000','agenda_capacidade_bloqueada','gate inicia fechado');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('17255000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','synthetic-s17255@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17255000-0000-4000-8000-000000000001','superadmin','Teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('17255000-0000-4000-8000-000000000002','A',true,'17255000-0000-4000-8000-000000000001'),('17255000-0000-4000-8000-000000000003','B',true,'17255000-0000-4000-8000-000000000001');
insert into pcm.funcionarios(id,nome) values ('17255000-0000-4000-8000-000000000004','Técnico teste');
insert into pcm.agenda_tecnico(id,funcionario_id,cliente_id,data,hora_inicio,hora_fim,created_by) values
 ('17255000-0000-4000-8000-000000000005','17255000-0000-4000-8000-000000000004','17255000-0000-4000-8000-000000000002','2026-10-27','08:00','09:00','17255000-0000-4000-8000-000000000001'),
 ('17255000-0000-4000-8000-000000000006','17255000-0000-4000-8000-000000000004','17255000-0000-4000-8000-000000000003','2026-10-27','10:00','11:00','17255000-0000-4000-8000-000000000001'),
 ('17255000-0000-4000-8000-000000000007','17255000-0000-4000-8000-000000000004','17255000-0000-4000-8000-000000000002','2026-11-02','08:00','09:00','17255000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17255000-0000-4000-8000-000000000001','capacidade.gerir','17255000-0000-4000-8000-000000000002');
update pcm.capacidade_agenda_tecnico_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17255000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select count(*) from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000002','2026-10-26',null,null,50)),1::bigint,'somente Cliente e semana selecionados');
select is((select hora_inicio from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000002','2026-10-26',null,null,50)),'08:00'::time,'horário original preservado');
select throws_ok($$select * from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000003','2026-10-26',null,null,50)$$,'42501','sem_acesso','outro Cliente sem concessão negado');
select throws_ok($$select * from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000002','2026-10-27',null,null,50)$$,'22023','consulta_invalida','data não segunda rejeitada');
select throws_ok($$select * from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000002','2026-10-26','2026-10-27',null,50)$$,'22023','consulta_invalida','cursor incompleto rejeitado');
select ok(not has_function_privilege('anon','pcm.sso_listar_agenda_tecnico_capacidade(uuid,date,date,uuid,integer)','execute'),'anon não tem acesso');
set local request.jwt.claims='{"sub":"17255000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente"}';
select throws_ok($$select * from pcm.sso_listar_agenda_tecnico_capacidade('17255000-0000-4000-8000-000000000002','2026-10-26',null,null,50)$$,'42501','sem_acesso','papel divergente negado');
reset role;
select ok(not (select prosecdef from pg_proc where oid='pcm.sso_listar_agenda_tecnico_capacidade(uuid,date,date,uuid,integer)'::regprocedure),'consulta usa invoker e RLS nativa');
select is((select count(*) from pcm.auvo_sync_outbox),(select quantidade from s172_outbox_antes),'fixture não cria envio Auvo');
select * from finish();
rollback;
