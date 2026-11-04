-- Integra concessão administrativa e comando real de Plano; todas as fixtures são revertidas.
begin;
set local app.auvo_sync_write = 'true';
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17030000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestor-integracao-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17030000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-integracao-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17030000-0000-0000-0000-000000000001', 'colaborador', 'Gestor teste', true),
 ('17030000-0000-0000-0000-000000000002', 'superadmin', 'Admin teste', true);
insert into config.usuario_modulos (user_id, modulo, nivel) values
 ('17030000-0000-0000-0000-000000000001', 'pcm', 'escrita');
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17030000-0000-0000-0000-00000000000a', 'Cliente A', true, '17030000-0000-0000-0000-000000000002'),
 ('17030000-0000-0000-0000-00000000000b', 'Cliente B', true, '17030000-0000-0000-0000-000000000002');

set local role authenticated;
set local request.jwt.claims = '{"sub":"17030000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000101', 0, '17030000-0000-0000-0000-000000000011', '17030000-0000-0000-0000-00000000000a', 'Plano A') $$, '42501', null, 'escrita PCM isolada não autoriza Plano');
set local request.jwt.claims = '{"sub":"17030000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$ select config.sso_definir_concessao('17030000-0000-0000-0000-000000000201', 0, '17030000-0000-0000-0000-000000000001', null, 'plano.gerir', '17030000-0000-0000-0000-00000000000a', true, 'Autorizar gestão') $$, 'administrador concede gestão para Cliente A');
set local request.jwt.claims = '{"sub":"17030000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000101', 0, '17030000-0000-0000-0000-000000000011', '17030000-0000-0000-0000-00000000000a', 'Plano A') $$, 'gestor cria Plano no Cliente concedido');
select throws_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000102', 0, '17030000-0000-0000-0000-000000000012', '17030000-0000-0000-0000-00000000000b', 'Plano B') $$, '42501', null, 'mesma concessão não autoriza Cliente B');
select lives_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000103', 1, '17030000-0000-0000-0000-000000000011', '17030000-0000-0000-0000-00000000000a', 'Plano A revisado') $$, 'gestor edita Plano existente');
set local request.jwt.claims = '{"sub":"17030000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$ select config.sso_definir_concessao('17030000-0000-0000-0000-000000000202', 1, '17030000-0000-0000-0000-000000000001', null, 'plano.gerir', '17030000-0000-0000-0000-00000000000a', false, 'Revogar gestão') $$, 'administrador revoga concessão');
set local request.jwt.claims = '{"sub":"17030000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000103', 1, '17030000-0000-0000-0000-000000000011', '17030000-0000-0000-0000-00000000000a', 'Plano A revisado') $$, '42501', null, 'retry anterior é negado após revogação com token antigo');
select throws_ok($$ select pcm.sso_salvar_plano_rascunho('17030000-0000-0000-0000-000000000104', 2, '17030000-0000-0000-0000-000000000011', '17030000-0000-0000-0000-00000000000a', 'Plano A modificado') $$, '42501', null, 'nova edição é negada após revogação');
reset role;
select is((select nome from pcm.planos_manutencao where id = '17030000-0000-0000-0000-000000000011'), 'Plano A revisado', 'revogação preserva o trabalho confirmado');
select * from finish();
rollback;
