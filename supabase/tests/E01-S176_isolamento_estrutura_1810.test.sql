-- S176: fixture sintética em clone descartável com migrations 1809/1810; sem Auvo.
-- O gate é ativado só na transação; rollback obrigatório. Concorrência requer ensaio separado.
begin;
set local app.auvo_sync_write = 'true';
select plan(11);
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
select throws_ok($$select pcm.sso_listar_composicao_estrutura_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','sistemas',null,null,false,0)$$,'55000','isolamento_desabilitado','mediador fecha quando gate está desligado');
select is((select count(*)::integer from pcm.sistemas where id in ('18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000012')),2,'gate desligado mantém exposição legada documentada');
reset role;
update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;
set local role authenticated;
select is((select count(*)::integer from pcm.sistemas where id in ('18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000012')),1,'RLS mostra somente Sistema do Cliente autorizado');
select is((select count(*)::integer from pcm.equipamentos where id in ('18100000-0000-4000-8000-000000000021','18100000-0000-4000-8000-000000000022')),1,'RLS mostra somente Equipamento do Cliente autorizado');
select is((select count(*)::integer from pcm.sistema_itens where sistema_id in ('18100000-0000-4000-8000-000000000011','18100000-0000-4000-8000-000000000012')),1,'RLS mostra somente vínculo do Cliente autorizado');
select is(jsonb_array_length(pcm.sso_listar_composicao_estrutura_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','sistemas',null,null,false,0)),1,'mediador retorna fonte do Cliente autorizado');
select throws_ok($$select pcm.sso_listar_composicao_estrutura_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000b','sistemas',null,null,false,0)$$,'42501','sem_acesso','mediador recusa outro Cliente');
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select is((select count(*)::integer from pcm.sistemas where id='18100000-0000-4000-8000-000000000011'),0,'sem claim PCM a política legada recusa leitura direta');
select throws_ok($$select pcm.sso_listar_composicao_estrutura_176('18100000-0000-4000-8000-000000000001','18100000-0000-4000-8000-00000000000a','sistemas',null,null,false,0)$$,'42501','sem_acesso','mediador não amplia claim PCM ausente');
select throws_ok($$select pcm.sso_listar_composicao_estrutura_176('18100000-0000-4000-8000-000000000099','18100000-0000-4000-8000-00000000000a','sistemas',null,null,false,0)$$,'42501','sem_acesso','mediador recusa ator divergente');
select is(has_function_privilege('anon','config.sso_estrutura_cliente_gate_ativo()','EXECUTE'),false,'gate interno não é exposto a anon');
select * from finish();
rollback;
