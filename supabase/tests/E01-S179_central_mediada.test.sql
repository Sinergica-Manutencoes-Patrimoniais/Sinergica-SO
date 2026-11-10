begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(10);
select has_function('pcm','sso_consultar_central_materiais_mediada',array['uuid','uuid','text','integer','uuid'],'consulta mediada existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17991000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s179-central@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17991000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('17991000-0000-4000-8000-000000000002','Cliente A','17991000-0000-4000-8000-000000000001'),
('17991000-0000-4000-8000-000000000003','Cliente B','17991000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17991000-0000-4000-8000-000000000001','material.gerir','17991000-0000-4000-8000-000000000002');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
('17991000-0000-4000-8000-000000000011','17991000-0000-4000-8000-000000000002','S179-A','OS A','corretiva','17991000-0000-4000-8000-000000000001'),
('17991000-0000-4000-8000-000000000012','17991000-0000-4000-8000-000000000003','S179-B','OS B','corretiva','17991000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,criado_por) values
('17991000-0000-4000-8000-000000000021','17991000-0000-4000-8000-000000000002','17991000-0000-4000-8000-000000000011','cliente','Material A','17991000-0000-4000-8000-000000000001'),
('17991000-0000-4000-8000-000000000022','17991000-0000-4000-8000-000000000003','17991000-0000-4000-8000-000000000012','sinergica','Material B','17991000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"17991000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002',null,null,20,null)$$,'55000','central_materiais_bloqueada','gate fechado recusa consulta');
reset role;
update pcm.sso_central_materiais_mediada_gate set habilitado=true where id;
set local role authenticated;
select is((select count(*)::integer from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002',null,null,20,null)),1,'retorna somente lista do Cliente autorizado');
select is((select texto_original from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002','17991000-0000-4000-8000-000000000011','cliente',20,null)),'Material A','filtra OS e responsável');
select is((select count(*)::integer from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002','17991000-0000-4000-8000-000000000012',null,20,null)),0,'OS de outro Cliente não retorna conteúdo');
select throws_ok($$select * from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000003',null,null,20,null)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','Cliente sem concessão é negado');
select throws_ok($$select * from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002',null,null,101,null)$$,'22023','parametros_invalidos','limite inválido é negado');
reset role;
select ok(not has_function_privilege('anon','pcm.sso_consultar_central_materiais_mediada(uuid,uuid,text,integer,uuid)','execute') and has_function_privilege('authenticated','pcm.sso_consultar_central_materiais_mediada(uuid,uuid,text,integer,uuid)','execute'),'somente authenticated acessa mediadora');
select ok(not has_function_privilege('authenticated','pcm.sso_consultar_central_materiais(uuid,uuid,text,integer,uuid)','execute'),'núcleo permanece privado');
update config.sso_concessoes set ativa=false where usuario_id='17991000-0000-4000-8000-000000000001' and acao='material.gerir';
set local role authenticated;
select throws_ok($$select * from pcm.sso_consultar_central_materiais_mediada('17991000-0000-4000-8000-000000000002',null,null,20,null)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','revogação sequencial nega consulta');
reset role;
select * from finish();
rollback;
