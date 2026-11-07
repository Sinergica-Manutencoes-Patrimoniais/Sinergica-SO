-- Somente fixtures sintéticas; transação revertida e sem sincronização Auvo.
begin;
set local app.auvo_sync_write = 'true';
select plan(13);
select has_function('pcm','sso_inventariar_codigos_legados',array[]::text[],'inventário agregado existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17710000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventario-s177@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('17710000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','negado-s177@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('17710000-0000-0000-0000-000000000001','superadmin','Inventário S177',true),
 ('17710000-0000-0000-0000-000000000002','colaborador','Negado S177',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('17710000-0000-0000-0000-00000000000a','Inventário S177',true,'17710000-0000-0000-0000-000000000001');
insert into pcm.clientes(id,nome,ativo,created_by) values ('17710000-0000-0000-0000-00000000000b','Outro Cliente S177',true,'17710000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub":"17710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
create temporary table inventario_base as select pcm.sso_inventariar_codigos_legados() valor;
reset role;
-- Dados anteriores às guardas: bypass local aos inserts sintéticos, revertido na transação.
set local session_replication_role = replica;
insert into pcm.equipamentos(id,nome,identificador,client_id) values
 ('17710000-0000-0000-0000-000000000011','Componente A','S177 teste legado 8091','17710000-0000-0000-0000-00000000000a'),
 ('17710000-0000-0000-0000-000000000012','Componente B',' s177 TESTE legado 8091 ',null),
 ('17710000-0000-0000-0000-000000000013','Componente C',' ',null);
insert into pcm.sistemas(id,cliente_id,nome,codigo,deleted_at) values ('17710000-0000-0000-0000-000000000021','17710000-0000-0000-0000-00000000000b','Sistema histórico','S177 teste legado 8091',now());
set local session_replication_role = origin;
set local role authenticated;
select is(((pcm.sso_inventariar_codigos_legados()->>'equipamentos')::int - (select (valor->>'equipamentos')::int from inventario_base)),3,'conta Componentes inclusive sem Cliente');
select is(((pcm.sso_inventariar_codigos_legados()->>'sistemas')::int - (select (valor->>'sistemas')::int from inventario_base)),1,'conta Sistemas inclusive excluídos');
select is(((pcm.sso_inventariar_codigos_legados()->>'equipamentosSemCliente')::int - (select (valor->>'equipamentosSemCliente')::int from inventario_base)),2,'conta Componentes sem Cliente');
select is(((pcm.sso_inventariar_codigos_legados()->>'codigosVazios')::int - (select (valor->>'codigosVazios')::int from inventario_base)),1,'conta código em branco');
select is(((pcm.sso_inventariar_codigos_legados()->>'excluidos')::int - (select (valor->>'excluidos')::int from inventario_base)),1,'inclui registro excluído');
select is(((pcm.sso_inventariar_codigos_legados()->>'gruposDuplicadosExatos')::int - (select (valor->>'gruposDuplicadosExatos')::int from inventario_base)),1,'detecta código exato entre tabelas e incluindo excluído');
select is(((pcm.sso_inventariar_codigos_legados()->>'gruposPossivelmenteEquivalentes')::int - (select (valor->>'gruposPossivelmenteEquivalentes')::int from inventario_base)),1,'detecta possível colisão sem reescrever valor');
select ok(position('S177 teste legado 8091' in pcm.sso_inventariar_codigos_legados()::text)=0,'resultado não expõe códigos');
select ok(not has_function_privilege('anon','pcm.sso_inventariar_codigos_legados()','EXECUTE'),'anon não pode consultar');
set local request.jwt.claims = '{"sub":"17710000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_inventariar_codigos_legados()$$,'42501',null,'papel do token não substitui superadmin ativo');
reset role;
update config.usuarios set ativo=false where user_id='17710000-0000-0000-0000-000000000001';
set local request.jwt.claims = '{"sub":"17710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_inventariar_codigos_legados()$$,'42501',null,'revogação impede inventário');
reset role;
select is((select identificador from pcm.equipamentos where id='17710000-0000-0000-0000-000000000012'),' s177 TESTE legado 8091 ','inventário não normaliza código original');
select * from finish();
rollback;
