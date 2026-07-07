-- clientes_crud_rls.test.sql — pgTAP (E01-S27, AC-1/2/3/9)
-- Prova que `pcm.clientes` tem colunas/trigger de sync e mantém RLS por módulo para escrita.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-leitura-s27@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s27@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('Cliente negado', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501',
  null,
  'pcm leitura NAO insere clientes (AC-9)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.clientes (id, nome, created_by, updated_by) values ('10000000-0000-0000-0000-00000000e027', 'Cliente S27', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2') $$,
  'pcm escrita insere clientes (AC-1/AC-9)'
);
select lives_ok(
  $$ update pcm.clientes set nome = 'Cliente S27 editado', updated_by = '00000000-0000-0000-0000-0000000000a2' where id = '10000000-0000-0000-0000-00000000e027' $$,
  'pcm escrita edita clientes (AC-2/AC-9)'
);
select lives_ok(
  $$ update pcm.clientes set deleted_at = now(), ativo = false, updated_by = '00000000-0000-0000-0000-0000000000a2' where id = '10000000-0000-0000-0000-00000000e027' $$,
  'pcm escrita soft-deleta clientes (AC-3/AC-9)'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'clientes' and row_id = '10000000-0000-0000-0000-00000000e027'),
  3,
  'trigger clientes enfileira create/update/delete no outbox'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'clientes' and row_id = '10000000-0000-0000-0000-00000000e027' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de clientes registra as tres operacoes esperadas'
);
reset role;

select * from finish();
rollback;
