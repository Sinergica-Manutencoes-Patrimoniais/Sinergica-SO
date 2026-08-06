-- auvo_sync_error_details_rls.test.sql — pgTAP E01-S123.
begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000123', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'error-detail-pcm@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000124', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'error-detail-none@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.auvo_sync_outbox (id, entity, row_id, op, status, last_error, enqueued_at)
values ('00000000-0000-0000-0000-000000000125', 'detail_test', '00000000-0000-0000-0000-000000000126', 'update', 'error', 'Cliente Auvo inexistente', now());
insert into pcm.auvo_entity_status (entity, write_enabled, last_error_at, last_error)
values ('detail_pull_test', true, now(), 'Bearer segredo-nao-expor')
on conflict (entity) do update set last_error_at = excluded.last_error_at, last_error = excluded.last_error;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000123","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is((select count(*)::int from pcm.auvo_sync_error_details where entity in ('detail_test', 'detail_pull_test')), 2, 'leitor PCM ve erro de outbox e pull');
select is((select last_error from pcm.auvo_sync_error_details where entity = 'detail_test'), 'Cliente Auvo inexistente', 'mensagem operacional permanece legível');
select is((select last_error from pcm.auvo_sync_error_details where entity = 'detail_pull_test'), 'Detalhe técnico protegido. Consulte os logs de sincronização.', 'segredo não é exposto');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000124","user_role":"colaborador","user_modulos":{}}';
select is((select count(*)::int from pcm.auvo_sync_error_details), 0, 'usuário sem PCM não vê detalhes');
reset role;

select * from finish();
rollback;
