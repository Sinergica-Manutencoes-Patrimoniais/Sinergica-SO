-- E01-S170: perfis acumuláveis e revogação independente. Fixtures locais.
begin;
set local app.auvo_sync_write = 'true';
select plan(27);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17020000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-perfis-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17020000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operador-perfis-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17020000-0000-0000-0000-000000000001', 'superadmin', 'Admin perfis S170', true),
 ('17020000-0000-0000-0000-000000000002', 'colaborador', 'Operador perfis S170', true);
insert into config.usuario_modulos (user_id, modulo, nivel) values ('17020000-0000-0000-0000-000000000002', 'pcm', 'escrita');
insert into pcm.clientes (id, nome, ativo, created_by) values ('17020000-0000-0000-0000-00000000000a', 'Cliente perfis S170', true, '17020000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17020000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$ select config.sso_definir_perfil('17020000-0000-0000-0000-000000000101', 0, '17020000-0000-0000-0000-000000000010', 'Perfil A S170', true, 'Cadastro') $$, 'administrador cria primeiro perfil');
select is((config.sso_definir_perfil('17020000-0000-0000-0000-000000000101', 0, '17020000-0000-0000-0000-000000000010', 'Perfil A S170', true, 'Cadastro') ->> 'revision')::int, 1, 'retry de criação é idempotente');
select throws_ok($$ select config.sso_definir_perfil('17020000-0000-0000-0000-000000000101', 0, '17020000-0000-0000-0000-000000000010', 'Perfil alterado', true, 'Cadastro') $$, '23505', null, 'requestId com payload diferente é recusado');
select lives_ok($$ select config.sso_definir_perfil('17020000-0000-0000-0000-000000000102', 0, '17020000-0000-0000-0000-000000000011', 'Perfil B S170', true, 'Cadastro') $$, 'administrador cria segundo perfil');
select lives_ok($$ select config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000103', 0, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000010', true, 'Atribuição') $$, 'vincula primeiro perfil');
select lives_ok($$ select config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000104', 0, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000011', true, 'Atribuição') $$, 'acumula segundo perfil');
select is((config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000104', 0, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000011', true, 'Atribuição') ->> 'revision')::int, 1, 'retry do vínculo preserva revisão');
select throws_ok($$ select config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000108', 0, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000011', false, 'Revogação') $$, '40001', null, 'revisão desatualizada do vínculo é recusada');
select throws_ok($$ select config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000101', 0, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000011', true, 'Atribuição') $$, '23505', null, 'requestId não pode ser reutilizado entre tipos de comando');
select lives_ok($$ select config.sso_definir_concessao('17020000-0000-0000-0000-000000000105', 0, null, '17020000-0000-0000-0000-000000000010', 'visita.confirmar', '17020000-0000-0000-0000-00000000000a', true, 'Atribuição') $$, 'concede ação ao primeiro perfil');
select lives_ok($$ select config.sso_definir_concessao('17020000-0000-0000-0000-000000000106', 0, null, '17020000-0000-0000-0000-000000000011', 'execucao.validar', '17020000-0000-0000-0000-00000000000a', true, 'Atribuição') $$, 'concede ação ao segundo perfil');
select is((select count(*)::int from config.sso_listar_perfis(0, 100)), 2, 'consulta administrativa lista perfis');
select is((select count(*)::int from config.sso_listar_usuarios(0, 100) where user_id in ('17020000-0000-0000-0000-000000000001','17020000-0000-0000-0000-000000000002')), 2, 'consulta administrativa lista usuários');
select is((select count(*)::int from config.sso_listar_clientes(0, 100) where id = '17020000-0000-0000-0000-00000000000a'), 1, 'consulta administrativa lista Clientes ativos');
select is((select count(*)::int from config.sso_listar_vinculos(0, 100)), 2, 'consulta administrativa lista vínculos');
select is((select count(*)::int from config.sso_listar_concessoes(0, 100)), 2, 'consulta administrativa lista concessões');
select throws_ok($$ select * from config.sso_listar_perfis(0, 101) $$, '22023', null, 'limite de página é protegido');
set local request.jwt.claims = '{"sub":"17020000-0000-0000-0000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is(config.sso_autorizar_acao('visita.confirmar', '17020000-0000-0000-0000-00000000000a') and config.sso_autorizar_acao('execucao.validar', '17020000-0000-0000-0000-00000000000a'), true, 'usuário acumula capacidades dos dois perfis');
set local request.jwt.claims = '{"sub":"17020000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$ select config.sso_definir_vinculo_perfil('17020000-0000-0000-0000-000000000107', 1, '17020000-0000-0000-0000-000000000002', '17020000-0000-0000-0000-000000000010', false, 'Revogação') $$, 'revoga vínculo com revisão atual');
set local request.jwt.claims = '{"sub":"17020000-0000-0000-0000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is(config.sso_autorizar_acao('visita.confirmar', '17020000-0000-0000-0000-00000000000a'), false, 'revogar vínculo bloqueia ação do primeiro perfil');
select is(config.sso_autorizar_acao('execucao.validar', '17020000-0000-0000-0000-00000000000a'), true, 'segundo perfil permanece efetivo');
select throws_ok($$ select config.sso_definir_perfil('17020000-0000-0000-0000-000000000109', 0, '17020000-0000-0000-0000-000000000012', 'Perfil indevido', true, 'Teste') $$, '42501', null, 'colaborador não configura perfil');
select throws_ok($$ select * from config.sso_listar_concessoes(0, 100) $$, '42501', null, 'colaborador não lista concessões administrativas');
select throws_ok($$ select * from config.sso_listar_usuarios(0, 100) $$, '42501', null, 'colaborador não lista usuários administrativos');
select throws_ok($$ select * from config.sso_listar_clientes(0, 100) $$, '42501', null, 'colaborador não usa listagem administrativa de Clientes');
select throws_ok($$ select config.sso_inicio_comando('17020000-0000-0000-0000-000000000110', '{}'::jsonb) $$, '42501', null, 'helper transacional não é público');
set local role service_role;
select is((select count(*)::int from audit.events where entity = 'sso_usuario_perfis' and payload ->> 'requestId' in ('17020000-0000-0000-0000-000000000103', '17020000-0000-0000-0000-000000000104', '17020000-0000-0000-0000-000000000107') and payload ->> 'motivo' is not null), 3, 'cada vínculo e revogação registra motivo uma vez');
select * from finish();
rollback;
