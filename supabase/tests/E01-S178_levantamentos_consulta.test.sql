-- Executar após 0315 e 0318, somente em transação isolada com rollback.
begin;
set local app.auvo_sync_write = 'true';
select plan(16);
select has_function('pcm', 'sso_listar_levantamentos', array['uuid','integer','uuid'], 'existe consulta de lotes');
select has_function('pcm', 'sso_listar_linhas_levantamento', array['uuid','uuid','integer','text'], 'existe consulta de linhas');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17810000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-leitura@example.test',crypt('x', gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17810000-0000-0000-0000-000000000001','colaborador','S178 leitura',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17810000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17810000-0000-0000-0000-00000000000a','S178 leitura A',true,'17810000-0000-0000-0000-000000000001'),
 ('17810000-0000-0000-0000-00000000000b','S178 leitura B',true,'17810000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17810000-0000-0000-0000-000000000001','cadastro.gerir','17810000-0000-0000-0000-00000000000a');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17810000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select lives_ok($$select pcm.sso_receber_levantamento_manual('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a","tipo":"area","atributos":{"nome":"Área"}},{"chave":"b","tipo":"local","atributos":{"nome":"Local"}}]')$$, 'recebe lote para consulta');
select lives_ok($$select pcm.sso_receber_levantamento_manual('17810000-0000-0000-0000-000000000102','17810000-0000-0000-0000-00000000000a','campo','lote-2','[{"chave":"c","tipo":"sistema","atributos":{"nome":"Provisório"}}]')$$, 'recebe segundo lote');
select is((select count(*)::int from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',100,null)),2,'lista somente lotes do Cliente autorizado');
select is((select count(*)::int from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',1,null)),1,'limite de lote é aplicado');
select is((select count(*)::int from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',1,(select id from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',1,null)))),1,'cursor avança para lote seguinte');
select is((select count(*)::int from pcm.sso_listar_linhas_levantamento('17810000-0000-0000-0000-00000000000a',(select id from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',100,null) where chave_origem='lote-1'),100,null)),2,'retorna duas linhas do lote selecionado');
select is((select chave from pcm.sso_listar_linhas_levantamento('17810000-0000-0000-0000-00000000000a',(select id from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',100,null) where chave_origem='lote-1'),1,'a')),'b','cursor avança por chave de linha');
select throws_ok($$select * from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000b',10,null)$$,'42501',null,'Cliente não autorizado é negado');
select throws_ok($$select * from pcm.sso_listar_linhas_levantamento('17810000-0000-0000-0000-00000000000a','17810000-0000-0000-0000-000000000099',10,null)$$,'42501',null,'lote ausente ou sem acesso é negado');
select throws_ok($$select * from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',101,null)$$,'22023',null,'limite excessivo é negado');
select throws_ok($$select * from pcm.sso_levantamentos$$,'42501',null,'leitura direta continua negada');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17810000-0000-0000-0000-000000000001' and acao='cadastro.gerir';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',10,null)$$,'42501',null,'revogação vale com JWT antigo');
reset role;
set local role service_role;
select throws_ok($$select * from pcm.sso_listar_levantamentos('17810000-0000-0000-0000-00000000000a',10,null)$$,'42501',null,'service_role não executa consulta');
reset role;
select is((select count(*)::int from audit.events where entity='sso_levantamentos' and actor_id='17810000-0000-0000-0000-000000000001'),2,'consulta não altera auditoria de recepção');
select * from finish();
rollback;
