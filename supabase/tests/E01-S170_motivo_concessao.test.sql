-- E01-S170: motivo é parte do comando idempotente e da auditoria append-only.
begin;
set local app.auvo_sync_write = 'true';
select plan(8);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17010000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-motivo-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17010000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operador-motivo-s170@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17010000-0000-0000-0000-000000000001', 'superadmin', 'Admin motivo S170', true),
 ('17010000-0000-0000-0000-000000000002', 'colaborador', 'Operador motivo S170', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17010000-0000-0000-0000-00000000000a', 'Cliente motivo S170', true, '17010000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17010000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000101', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true) $$, '42501', null, 'assinatura sem motivo não pode ser usada');
select throws_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000101', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true, '   ') $$, '22023', null, 'motivo vazio é recusado');
select lives_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000101', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true, 'Necessidade operacional') $$, 'concessão com motivo é aceita');
select lives_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000101', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true, 'Necessidade operacional') $$, 'retry idêntico é aceito');
select throws_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000101', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true, 'Outro motivo') $$, '23505', null, 'mesmo requestId com motivo diferente é conflito');
select throws_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000102', 0, '17010000-0000-0000-0000-000000000099', null, 'execucao.validar', '17010000-0000-0000-0000-00000000000a', true, 'Teste') $$, '22023', null, 'concessão não aponta para usuário ausente');
select throws_ok($$ select config.sso_definir_concessao('17010000-0000-0000-0000-000000000103', 0, '17010000-0000-0000-0000-000000000002', null, 'execucao.validar', '17010000-0000-0000-0000-000000000099', true, 'Teste') $$, '22023', null, 'concessão não aponta para Cliente ausente');
set local role service_role;
select is((select count(*)::int from audit.events where entity = 'sso_concessoes' and payload ->> 'requestId' = '17010000-0000-0000-0000-000000000101' and payload ->> 'motivo' = 'Necessidade operacional' and payload ? 'antes' and payload ? 'depois'), 1, 'auditoria registra motivo, antes e depois uma única vez');
select * from finish();
rollback;
