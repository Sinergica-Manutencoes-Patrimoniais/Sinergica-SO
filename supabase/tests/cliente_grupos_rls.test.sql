-- cliente_grupos_rls.test.sql — pgTAP (E01-S27, AC-6/7/8/9)
-- Prova RLS e trigger de outbox de `pcm.cliente_grupos`.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grupo-leitura-s27@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grupo-escrita-s27@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.cliente_grupos (nome, created_by) values ('Grupo negado', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501',
  null,
  'pcm leitura NAO insere cliente_grupos (AC-9)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.cliente_grupos (id, nome, cliente_ids, clientes_auvo_ids, created_by, updated_by) values ('20000000-0000-0000-0000-00000000e027', 'Grupo S27', array['10000000-0000-0000-0000-00000000e027']::uuid[], array[77]::bigint[], '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2') $$,
  'pcm escrita cria cliente_grupos (AC-6/AC-9)'
);
select lives_ok(
  $$ update pcm.cliente_grupos set nome = 'Grupo S27 local', updated_by = '00000000-0000-0000-0000-0000000000b2' where id = '20000000-0000-0000-0000-00000000e027' $$,
  'pcm escrita renomeia cliente_grupos localmente (AC-8/AC-9)'
);
select lives_ok(
  $$ update pcm.cliente_grupos set deleted_at = now(), updated_by = '00000000-0000-0000-0000-0000000000b2' where id = '20000000-0000-0000-0000-00000000e027' $$,
  'pcm escrita soft-deleta cliente_grupos para hard-delete no drain (AC-7/AC-9)'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'cliente_grupos' and row_id = '20000000-0000-0000-0000-00000000e027'),
  3,
  'trigger cliente_grupos enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'cliente_grupos' and row_id = '20000000-0000-0000-0000-00000000e027' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de cliente_grupos registra update no-op para o drain e delete hard-delete'
);
reset role;

select * from finish();
rollback;
