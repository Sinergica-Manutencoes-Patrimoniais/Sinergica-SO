-- servicos_rls.test.sql — pgTAP (E01-S31, AC-6)
-- `pcm.servicos.auvo_id` é text/GUID, não bigint.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'serv-leitura-s31@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'serv-escrita-s31@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

select is(
  (select data_type from information_schema.columns where table_schema = 'pcm' and table_name = 'servicos' and column_name = 'auvo_id'),
  'text',
  'servicos.auvo_id e text para GUID Auvo'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000311","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.servicos (titulo, preco_centavos, created_by) values ('Serviço negado', 1000, '00000000-0000-0000-0000-000000000311') $$,
  '42501',
  null,
  'pcm leitura NAO insere servicos'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000312","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.servicos (id, titulo, preco_centavos, auvo_id, created_by, updated_by) values ('31000000-0000-0000-0000-000000000001', 'Serviço S31', 12500, '55f4d070-a9a7-4f3f-8a2b-c0d7ef6d88bb', '00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000312') $$,
  'pcm escrita insere servicos'
);
select lives_ok(
  $$ update pcm.servicos set preco_centavos = 15000, updated_by = '00000000-0000-0000-0000-000000000312' where id = '31000000-0000-0000-0000-000000000001' $$,
  'pcm escrita edita servicos'
);
select lives_ok(
  $$ update pcm.servicos set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000312' where id = '31000000-0000-0000-0000-000000000001' $$,
  'pcm escrita desativa servicos'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'servicos' and row_id = '31000000-0000-0000-0000-000000000001'),
  3,
  'trigger servicos enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'servicos' and row_id = '31000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de servicos registra as operacoes esperadas'
);
reset role;

select * from finish();
rollback;
