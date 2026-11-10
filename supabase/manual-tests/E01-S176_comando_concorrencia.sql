-- Somente banco local descartável, psql como supabase_admin. As duas operações são revertidas.
begin;
create extension if not exists dblink with schema extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(6);
select extensions.dblink_connect_u('s176ca', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s176cb', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s176ca', $$
 set app.auvo_sync_write = 'true';
 insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
 values ('17630000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comando-concorrencia@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
 insert into config.usuarios(user_id, papel, nome, ativo) values ('17630000-0000-0000-0000-000000000001', 'superadmin', 'Concorrência comando', true);
 insert into pcm.clientes(id, nome, ativo, created_by) values ('17630000-0000-0000-0000-00000000000a', 'Cliente concorrência comando', true, '17630000-0000-0000-0000-000000000001');
 insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17630000-0000-0000-0000-000000000001', 'cadastro.gerir', '17630000-0000-0000-0000-00000000000a');
 insert into pcm.equipamentos(id, nome, client_id, ativo) values
 ('17630000-0000-0000-0000-000000000011', 'Componente concorrente', '17630000-0000-0000-0000-00000000000a', true),
 ('17630000-0000-0000-0000-000000000012', 'Pai concorrente', '17630000-0000-0000-0000-00000000000a', true);
$$);
select extensions.dblink_exec('s176cb', $$ set app.auvo_sync_write = 'true' $$);
select extensions.dblink_exec('s176ca', $$ set request.jwt.claims = '{"sub":"17630000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s176cb', $$ set request.jwt.claims = '{"sub":"17630000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s176ca', 'set role authenticated');
select extensions.dblink_exec('s176cb', 'set role authenticated');
select extensions.dblink_exec('s176ca', 'begin');
select extensions.dblink_exec('s176cb', 'begin');
select is((resultado ->> 'revision')::int, 2, 'primeiro comando cria revisão em transação pendente') from extensions.dblink('s176ca', $$
 select pcm.sso_mover_componente('17630000-0000-0000-0000-000000000101', 1, '17630000-0000-0000-0000-000000000011', null, null, '17630000-0000-0000-0000-000000000012')
$$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s176cb', $$ select pcm.sso_mover_componente('17630000-0000-0000-0000-000000000101', 1, '17630000-0000-0000-0000-000000000011', null, null, '17630000-0000-0000-0000-000000000012') $$), 1, 'inicia repetição concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s176cb'), 1, 'repetição aguarda transação original');
select extensions.dblink_exec('s176ca', 'rollback');
select is((resultado ->> 'revision')::int, 2, 'após rollback original, repetição executa uma vez') from extensions.dblink_get_result('s176cb') as t(resultado jsonb);
select * from extensions.dblink_get_result('s176cb') as t(resultado jsonb);
select extensions.dblink_exec('s176cb', 'rollback');
select is((select estrutura_revisao from pcm.equipamentos where id = '17630000-0000-0000-0000-000000000011'), 1, 'rollback das sessões preserva revisão inicial');
select is((select count(*)::int from audit.events where entity_id = '17630000-0000-0000-0000-000000000011'), 0, 'rollback das sessões não persiste auditoria sintética');
select extensions.dblink_exec('s176ca', 'reset role');
select extensions.dblink_exec('s176ca', $$
 delete from pcm.equipamentos where id in ('17630000-0000-0000-0000-000000000011','17630000-0000-0000-0000-000000000012');
 delete from config.sso_concessoes where usuario_id = '17630000-0000-0000-0000-000000000001';
 delete from pcm.clientes where id = '17630000-0000-0000-0000-00000000000a';
 delete from config.usuarios where user_id = '17630000-0000-0000-0000-000000000001';
 delete from auth.users where id = '17630000-0000-0000-0000-000000000001';
$$);
select extensions.dblink_disconnect('s176ca');
select extensions.dblink_disconnect('s176cb');
select * from finish();
rollback;
