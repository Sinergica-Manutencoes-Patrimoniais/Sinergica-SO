-- S176: fixture sintética em clone descartável com migrations 1809/1810; sem Auvo.
-- O gate é ativado só na transação; rollback obrigatório. Concorrência requer ensaio separado.
begin;
set local app.auvo_sync_write = 'true';
select plan(7);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','isolamento-1810@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18100000-0000-4000-8000-000000000001','colaborador','Ator sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('18100000-0000-4000-8000-000000000001','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18100000-0000-4000-8000-00000000000a','Cliente A',true,'18100000-0000-4000-8000-000000000001'),
 ('18100000-0000-4000-8000-00000000000b','Cliente B',true,'18100000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18100000-0000-4000-8000-000000000001','cadastro.ler','18100000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values
 ('18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-00000000000a','Sistema A'),
 ('18100000-0000-4000-8000-000000000012','18100000-0000-4000-8000-00000000000b','Sistema B');
insert into pcm.equipamentos(id,nome,client_id) values
 ('18100000-0000-4000-8000-000000000021','Item A','18100000-0000-4000-8000-00000000000a'),
 ('18100000-0000-4000-8000-000000000022','Item B','18100000-0000-4000-8000-00000000000b');
insert into pcm.sistema_itens(sistema_id,item_id) values
 ('18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000021'),
 ('18100000-0000-4000-8000-000000000012','18100000-0000-4000-8000-000000000022');
set local role authenticated;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok($$select pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000021')$$,'55000','isolamento_desabilitado','gate fechado nega leitura');
reset role;
update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;
set local role authenticated;
select is(pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000021')->>'id','18100000-0000-4000-8000-000000000021','item vinculado é retornado');
select is(pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000022'),null::jsonb,'item sem vínculo não é exposto');
select throws_ok($$select pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000b','18100000-0000-4000-8000-000000000012','18100000-0000-4000-8000-000000000022')$$,'42501','sem_acesso','outro Cliente negado');
select throws_ok($$select pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000099','18100000-0000-4000-8000-00000000000a','18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000021')$$,'42501','sem_acesso','ator divergente negado');
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select pcm.sso_membro_sistema_por_id_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000021')$$,'42501','sem_acesso','sem claim PCM a leitura é negada');
select is(has_function_privilege('anon','pcm.sso_membro_sistema_por_id_176(uuid,uuid,uuid,uuid)','EXECUTE'),false,'anon não executa mediador');
select * from finish();
rollback;
