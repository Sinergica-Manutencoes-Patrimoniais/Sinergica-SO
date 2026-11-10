-- Exclusivamente banco diagnóstico: transação revertida, nenhum efeito externo.
begin;
set local app.auvo_sync_write='true';
set local search_path=extensions,public;
select plan(8);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16798011-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-lista@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16798011-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('16798011-0000-4000-8000-00000000000a','Cliente A','16798011-0000-4000-8000-000000000001'),
('16798011-0000-4000-8000-00000000000b','Cliente B','16798011-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16798011-0000-4000-8000-000000000001','chamado.os.criar','16798011-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
('16798011-0000-4000-8000-000000000011','CH-S167-LISTA','16798011-0000-4000-8000-00000000000a','Chamado A','16798011-0000-4000-8000-000000000001'),
('16798011-0000-4000-8000-000000000012','CH-S167-LISTA-B','16798011-0000-4000-8000-00000000000b','Chamado B','16798011-0000-4000-8000-000000000001');
insert into pcm.equipamentos(id,client_id,nome) select ('16798012-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'16798011-0000-4000-8000-00000000000a','Componente ' || n from generate_series(1,3) n;
select has_function('pcm','sso_listar_componentes_conversao',array['uuid','uuid','uuid','integer'],'RPC mediada existe');
select ok(not has_function_privilege('anon','pcm.sso_listar_componentes_conversao(uuid,uuid,uuid,integer)','execute'),'anon sem execução');
set local role authenticated;
set local request.jwt.claims='{"sub":"16798011-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select * from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000a','16798011-0000-4000-8000-000000000011',null,2)$$,'55000','conversao_integral_mediada_bloqueada','gate fechado bloqueia leitura');
reset role;
update pcm.sso_conversao_integral_mediada_gate set habilitado=true where id;
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000a','16798011-0000-4000-8000-000000000011',null,2)),2,'primeira página limitada');
select is((select count(*)::int from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000a','16798011-0000-4000-8000-000000000011','16798012-0000-4000-8000-000000000002',2)),1,'cursor alcança página seguinte');
select throws_ok($$select * from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000b','16798011-0000-4000-8000-000000000011',null,2)$$,'42501','chamado_nao_encontrado_ou_sem_acesso','Cliente divergente negado');
select throws_ok($$select * from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000b','16798011-0000-4000-8000-000000000012',null,2)$$,'42501','chamado_nao_encontrado_ou_sem_acesso','Cliente B sem concessão negado');
reset role;
update config.usuarios set ativo=false where user_id='16798011-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_componentes_conversao('16798011-0000-4000-8000-00000000000a','16798011-0000-4000-8000-000000000011',null,2)$$,'42501','chamado_nao_encontrado_ou_sem_acesso','revogação sequencial bloqueia');
reset role;
select * from finish();
rollback;
