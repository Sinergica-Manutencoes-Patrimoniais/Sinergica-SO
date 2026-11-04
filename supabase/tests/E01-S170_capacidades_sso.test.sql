-- E01-S170: autorização por ação, escopo e estado atual. Fixtures locais com rollback.
begin;
set local app.auvo_sync_write = 'true';
select plan(28);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'planejador-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'financeiro-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17000000-0000-0000-0000-000000000001', 'colaborador', 'Planejador S170', true),
 ('17000000-0000-0000-0000-000000000002', 'superadmin', 'Admin S170', true),
 ('17000000-0000-0000-0000-000000000003', 'colaborador', 'Financeiro S170', true);
insert into config.usuario_modulos (user_id, modulo, nivel) values ('17000000-0000-0000-0000-000000000001', 'pcm', 'escrita');
insert into config.usuario_modulos (user_id, modulo, nivel) values ('17000000-0000-0000-0000-000000000003', 'financeiro', 'leitura');
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17000000-0000-0000-0000-00000000000a', 'Cliente A S170', true, '17000000-0000-0000-0000-000000000002'),
 ('17000000-0000-0000-0000-00000000000b', 'Cliente B S170', true, '17000000-0000-0000-0000-000000000002');

insert into config.sso_perfis (id, nome) values ('17000000-0000-0000-0000-000000000010', 'Perfil S170');
insert into config.sso_usuario_perfis (usuario_id, perfil_id) values ('17000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000010');
insert into config.sso_concessoes (perfil_id, acao, cliente_id) values
 ('17000000-0000-0000-0000-000000000010', 'plano.gerir', '17000000-0000-0000-0000-00000000000a'),
 ('17000000-0000-0000-0000-000000000010', 'visita.confirmar', '17000000-0000-0000-0000-00000000000b');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values ('17000000-0000-0000-0000-000000000003', 'custo.ler', '17000000-0000-0000-0000-00000000000a');

set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000a'), false, 'perfil e módulo não substituem concessão individual de gestão');
select is(config.sso_autorizar_acao('visita.confirmar', '17000000-0000-0000-0000-00000000000b'), true, 'perfil ativo concede ação para Cliente correspondente');
select is(config.sso_autorizar_acao('visita.confirmar', '17000000-0000-0000-0000-00000000000a'), false, 'perfil não atravessa Cliente');
select is(config.sso_autorizar_acao('execucao.validar', '17000000-0000-0000-0000-00000000000b'), false, 'módulo PCM não libera ação sem concessão');
reset role;
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values ('17000000-0000-0000-0000-000000000001', 'plano.gerir', '17000000-0000-0000-0000-00000000000a');
set local role authenticated;
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000a'), true, 'concessão individual autoriza gestão do próprio escopo');
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000b'), false, 'concessão individual não atravessa Cliente');
reset role;
delete from config.usuario_modulos where user_id = '17000000-0000-0000-0000-000000000001' and modulo = 'pcm';
set local role authenticated;
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000a'), false, 'revogação de módulo vale com JWT antigo');
reset role;
insert into config.usuario_modulos (user_id, modulo, nivel) values ('17000000-0000-0000-0000-000000000001', 'pcm', 'escrita');
update config.sso_concessoes set ativa = false where usuario_id = '17000000-0000-0000-0000-000000000001' and acao = 'plano.gerir';
set local role authenticated;
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000a'), false, 'revogação da concessão vale com JWT antigo');
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000003","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select is(config.sso_autorizar_acao('custo.ler', '17000000-0000-0000-0000-00000000000a'), true, 'financeiro com concessão pode consultar custos sem módulo comercial');
select is(config.sso_autorizar_acao('custo.ler', '17000000-0000-0000-0000-00000000000b'), false, 'financeiro não consulta custo de Cliente não concedido');
reset role;
delete from config.usuario_modulos where user_id = '17000000-0000-0000-0000-000000000003' and modulo = 'financeiro';
set local role authenticated;
select is(config.sso_autorizar_acao('custo.ler', '17000000-0000-0000-0000-00000000000a'), false, 'revogação do módulo financeiro vale com JWT antigo');
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select is(config.sso_autorizar_acao('plano.gerir', '17000000-0000-0000-0000-00000000000a'), false, 'superadmin sem concessão individual não gere Plano');
select is(config.sso_autorizar_acao('acao.inexistente', '17000000-0000-0000-0000-00000000000a'), false, 'ação desconhecida é negada');
select lives_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000101', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000a', true, 'Teste operacional') $$, 'administrador concede capacidade individual');
select is((config.sso_definir_concessao('17000000-0000-0000-0000-000000000101', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000a', true, 'Teste operacional') ->> 'revision')::int, 1, 'retry idêntico preserva revisão');
select throws_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000101', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000b', true, 'Teste operacional') $$, '23505', null, 'reutilizar requestId com outro conteúdo gera conflito');
select throws_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000102', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000a', false, 'Teste operacional') $$, '40001', null, 'revisão obsoleta é recusada');
select lives_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000103', 1, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000a', false, 'Teste operacional') $$, 'revogação usa revisão atual');
select throws_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000104', 0, null, '17000000-0000-0000-0000-000000000010', 'plano.gerir', '17000000-0000-0000-0000-00000000000a', true, 'Teste operacional') $$, '22023', null, 'gestão de Plano não é concedida a perfil');
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000105', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000b', true, 'Teste operacional') $$, '42501', null, 'colaborador não atribui capacidade');
select throws_ok($$ insert into config.sso_concessoes (usuario_id, acao) values ('17000000-0000-0000-0000-000000000001', 'plano.gerir') $$, '42501', null, 'escrita direta de concessão é negada');
reset role;
update config.usuarios set ativo = false where user_id = '17000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$ select config.sso_definir_concessao('17000000-0000-0000-0000-000000000106', 0, '17000000-0000-0000-0000-000000000001', null, 'execucao.validar', '17000000-0000-0000-0000-00000000000b', true, 'Teste operacional') $$, '42501', null, 'administrador desativado não concede com token antigo');
set local role service_role;
select is((select count(*)::int from audit.events where entity = 'sso_concessoes' and payload ->> 'requestId' in ('17000000-0000-0000-0000-000000000101', '17000000-0000-0000-0000-000000000103')), 2, 'concessão e revogação geram exatamente dois eventos');
select throws_ok($$ update audit.events set action = 'alterado' where entity = 'sso_concessoes' $$, '42501', null, 'service_role não altera auditoria');
select throws_ok($$ delete from audit.events where entity = 'sso_concessoes' $$, '42501', null, 'service_role não exclui auditoria');
select throws_ok($$ insert into config.sso_concessoes (usuario_id, acao, cliente_id) values ('17000000-0000-0000-0000-000000000001', 'visita.confirmar', '17000000-0000-0000-0000-00000000000a') $$, '42501', null, 'service_role não insere concessão sem RPC auditada');
select throws_ok($$ update config.sso_concessoes set ativa = false where usuario_id = '17000000-0000-0000-0000-000000000001' $$, '42501', null, 'service_role não altera concessão sem RPC auditada');
select throws_ok($$ delete from config.sso_concessoes where usuario_id = '17000000-0000-0000-0000-000000000001' $$, '42501', null, 'service_role não exclui concessão sem RPC auditada');
select * from finish();
rollback;
