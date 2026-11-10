-- Busca exata em dados sintéticos, somente banco isolado e transação revertida.
begin;
-- Exercita o núcleo legado sob concessão transacional; não altera o rollout do mediador.
grant execute on function pcm.sso_localizar_codigo_publico(uuid,text) to authenticated;
set local app.auvo_sync_write='true';
select plan(7);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('17920000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','busca-alias-s177@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17920000-0000-0000-0000-000000000001','colaborador','Busca alias',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17920000-0000-0000-0000-000000000001','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values ('17920000-0000-0000-0000-00000000000a','Busca A',true,'17920000-0000-0000-0000-000000000001'),('17920000-0000-0000-0000-00000000000b','Busca B',true,'17920000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17920000-0000-0000-0000-000000000001','cadastro.ler','17920000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17920000-0000-0000-0000-000000000011','17920000-0000-0000-0000-00000000000a','Sistema A','S177-BUSCA-ATUAL'),('17920000-0000-0000-0000-000000000012','17920000-0000-0000-0000-00000000000b','Sistema B','S177-BUSCA-OUTRO');
insert into pcm.sso_codigo_aliases(cliente_id,sistema_id,codigo,criado_por,motivo) values ('17920000-0000-0000-0000-00000000000a','17920000-0000-0000-0000-000000000011','S177-busca-antigo','17920000-0000-0000-0000-000000000001','teste');
set local request.jwt.claims='{"sub":"17920000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select is(pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000a','S177-BUSCA-ATUAL')->>'ativoId','17920000-0000-0000-0000-000000000011','código atual encontra ativo');
select is(pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000a','S177-busca-antigo')->>'ativoId','17920000-0000-0000-0000-000000000011','alias encontra o mesmo ativo');
select is(pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000a','S177-BUSCA-ANTIGO')->>'situacao','nao_encontrado','busca preserva comparação exata');
select is(pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000a','S177-BUSCA-OUTRO')->>'situacao','nao_encontrado','código de outro Cliente não é revelado');
select throws_ok($$select pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000b','S177-BUSCA-OUTRO')$$,'42501',null,'Cliente não autorizado negado');
select ok(not has_function_privilege('anon','pcm.sso_localizar_codigo_publico(uuid,text)','EXECUTE'),'anon não consulta');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17920000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select pcm.sso_localizar_codigo_publico('17920000-0000-0000-0000-00000000000a','S177-busca-antigo')$$,'42501',null,'revogação impede consulta de alias');
reset role;
select * from finish();
rollback;
