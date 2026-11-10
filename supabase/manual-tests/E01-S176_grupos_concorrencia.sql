-- Executar apenas em banco local descartável como supabase_admin: após 0251, eventos de
-- auditoria são append-only e permanecem mesmo depois da remoção das fixtures abaixo.
begin;
create extension if not exists dblink with schema extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);
select extensions.dblink_connect_u('s176a', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s176b', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s176a', $$
  set app.auvo_sync_write = 'true';
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('17620000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'concorrencia-s176@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
  insert into pcm.clientes(id, nome, ativo, created_by) values
    ('17620000-0000-0000-0000-00000000000a', 'Concorrência A', true, '17620000-0000-0000-0000-000000000001'),
    ('17620000-0000-0000-0000-00000000000b', 'Concorrência B', true, '17620000-0000-0000-0000-000000000001');
  insert into pcm.areas(id, cliente_id, nome) values
    ('17620000-0000-0000-0000-000000000021', '17620000-0000-0000-0000-00000000000a', 'Área A'),
    ('17620000-0000-0000-0000-000000000022', '17620000-0000-0000-0000-00000000000b', 'Área B');
  insert into pcm.locais(id, area_id, nome) values ('17620000-0000-0000-0000-000000000031', '17620000-0000-0000-0000-000000000021', 'Local A');
  insert into pcm.equipamento_categorias(id, nome) values ('17620000-0000-0000-0000-000000000041', 'Categoria concorrência S176');
  insert into pcm.equipamentos(id, nome, client_id, ativo) values
    ('17620000-0000-0000-0000-000000000071', 'Componente A', '17620000-0000-0000-0000-00000000000a', true),
    ('17620000-0000-0000-0000-000000000072', 'Componente B', '17620000-0000-0000-0000-00000000000a', true);
$$);
select extensions.dblink_exec('s176b', $$ set app.auvo_sync_write = 'true' $$);
select extensions.dblink_exec('s176a', 'begin');
select extensions.dblink_exec('s176a', $$
  insert into pcm.grupos_quantitativos(id, cliente_id, local_id, categoria_id, nome, quantidade, created_by, updated_by)
  values ('17620000-0000-0000-0000-000000000061', '17620000-0000-0000-0000-00000000000a',
    '17620000-0000-0000-0000-000000000031', '17620000-0000-0000-0000-000000000041', 'Grupo', 20,
    '17620000-0000-0000-0000-000000000001', '17620000-0000-0000-0000-000000000001')
$$);
select is(extensions.dblink_send_query('s176b', $$ update pcm.locais set area_id = '17620000-0000-0000-0000-000000000022' where id = '17620000-0000-0000-0000-000000000031' $$), 1, 'inicia alteração concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s176b'), 1, 'alteração espera a transação que cria grupo');
select extensions.dblink_exec('s176a', 'commit');
select * from extensions.dblink_get_result('s176b', false) as t(resultado text);
select * from extensions.dblink_get_result('s176b', false) as t(resultado text);
select is((select area_id::text from pcm.locais where id = '17620000-0000-0000-0000-000000000031'), '17620000-0000-0000-0000-000000000021', 'Local permanece no Cliente do grupo após concorrência');
select extensions.dblink_exec('s176a', $$ delete from pcm.grupos_quantitativos where id = '17620000-0000-0000-0000-000000000061' $$);
select extensions.dblink_exec('s176a', 'begin');
select extensions.dblink_exec('s176a', $$ update pcm.locais set area_id = '17620000-0000-0000-0000-000000000022' where id = '17620000-0000-0000-0000-000000000031' $$);
select is(extensions.dblink_send_query('s176b', $$ insert into pcm.grupos_quantitativos(id, cliente_id, local_id, categoria_id, nome, quantidade, created_by, updated_by)
  values ('17620000-0000-0000-0000-000000000061', '17620000-0000-0000-0000-00000000000a',
    '17620000-0000-0000-0000-000000000031', '17620000-0000-0000-0000-000000000041', 'Grupo', 20,
    '17620000-0000-0000-0000-000000000001', '17620000-0000-0000-0000-000000000001') $$), 1, 'inicia criação concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s176b'), 1, 'criação espera mudança do Local');
select extensions.dblink_exec('s176a', 'commit');
select * from extensions.dblink_get_result('s176b', false) as t(resultado text);
select is((select count(*)::int from pcm.grupos_quantitativos where id = '17620000-0000-0000-0000-000000000061'), 0, 'grupo de outro Cliente não é criado depois da mudança');
select * from extensions.dblink_get_result('s176b', false) as t(resultado text);
select extensions.dblink_exec('s176a', 'begin');
select extensions.dblink_exec('s176a', $$ update pcm.equipamentos set parent_item_id = '17620000-0000-0000-0000-000000000072' where id = '17620000-0000-0000-0000-000000000071' $$);
select is(extensions.dblink_send_query('s176b', $$ update pcm.equipamentos set parent_item_id = '17620000-0000-0000-0000-000000000071' where id = '17620000-0000-0000-0000-000000000072' $$), 1, 'inicia vínculo inverso concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s176b'), 1, 'vínculo inverso espera a primeira transação');
select extensions.dblink_exec('s176a', 'commit');
select * from extensions.dblink_get_result('s176b', false) as t(resultado text);
select is((select parent_item_id::text from pcm.equipamentos where id = '17620000-0000-0000-0000-000000000072'), null::text, 'ciclo concorrente é recusado');
select extensions.dblink_exec('s176a', $$
  delete from pcm.grupos_quantitativos where id = '17620000-0000-0000-0000-000000000061';
  update pcm.equipamentos set parent_item_id = null where id = '17620000-0000-0000-0000-000000000071';
  delete from pcm.equipamentos where id in ('17620000-0000-0000-0000-000000000071', '17620000-0000-0000-0000-000000000072');
  delete from pcm.locais where id = '17620000-0000-0000-0000-000000000031';
  delete from pcm.areas where id in ('17620000-0000-0000-0000-000000000021', '17620000-0000-0000-0000-000000000022');
  delete from pcm.clientes where id in ('17620000-0000-0000-0000-00000000000a', '17620000-0000-0000-0000-00000000000b');
  delete from pcm.equipamento_categorias where id = '17620000-0000-0000-0000-000000000041';
  delete from auth.users where id = '17620000-0000-0000-0000-000000000001';
$$);
select extensions.dblink_disconnect('s176a');
select extensions.dblink_disconnect('s176b');
select * from finish();
rollback;
