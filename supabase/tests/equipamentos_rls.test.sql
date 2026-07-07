-- equipamentos_rls.test.sql — pgTAP (E01-S29, AC-7)
-- `pcm.equipamentos` é a promoção editável do cache read-only `pcm.equipamentos_cache`.
-- ADR-0006: PCM origina cadastro/comando; Auvo segue autoridade operacional.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000291', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'equip-leitura-s29@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000292', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'equip-escrita-s29@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000291","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.equipamentos (nome, created_by) values ('Equipamento negado', '00000000-0000-0000-0000-000000000291') $$,
  '42501',
  null,
  'pcm leitura NAO insere equipamentos'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000292","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.equipamentos (id, nome, auvo_equipment_id, auvo_id, created_by, updated_by) values ('29000000-0000-0000-0000-000000000001', 'Equipamento S29', 290001, 290001, '00000000-0000-0000-0000-000000000292', '00000000-0000-0000-0000-000000000292') $$,
  'pcm escrita insere equipamentos'
);
select lives_ok(
  $$ update pcm.equipamentos set categoria = 'Bomba', updated_by = '00000000-0000-0000-0000-000000000292' where id = '29000000-0000-0000-0000-000000000001' $$,
  'pcm escrita edita equipamentos'
);
select lives_ok(
  $$ update pcm.equipamentos set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000292' where id = '29000000-0000-0000-0000-000000000001' $$,
  'pcm escrita desativa equipamentos'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'equipamentos' and row_id = '29000000-0000-0000-0000-000000000001'),
  3,
  'trigger equipamentos enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'equipamentos' and row_id = '29000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de equipamentos registra as operacoes esperadas'
);
reset role;

select * from finish();
rollback;
