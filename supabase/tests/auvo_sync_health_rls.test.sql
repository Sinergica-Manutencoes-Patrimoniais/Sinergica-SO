-- auvo_sync_health_rls.test.sql — pgTAP E00-S11.
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'health-pcm@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'health-none@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.auvo_entity_status (entity, write_enabled, last_pull_ok_at, last_error_at, last_error)
values ('health_test', false, now(), now(), 'dry-run explícito')
on conflict (entity) do update set write_enabled = false, last_error = 'dry-run explícito';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000111","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is((select count(*)::int from pcm.auvo_sync_health where entity = 'health_test'), 1, 'leitor PCM ve saude');
select is((select write_enabled from pcm.auvo_sync_health where entity = 'health_test'), false, 'dry-run fica visivel');
select isnt((select last_pull_ok_at from pcm.auvo_sync_health where entity = 'health_test'), null, 'ultimo pull fica visivel');
select is((select last_error from pcm.auvo_sync_health where entity = 'health_test'), 'dry-run explícito', 'erro fica visivel');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000112","user_role":"colaborador","user_modulos":{}}';
select is((select count(*)::int from pcm.auvo_sync_health), 0, 'usuario sem PCM nao ve saude');
reset role;

select * from finish();
rollback;
