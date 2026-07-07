-- funcionarios_rls.test.sql — pgTAP (E01-S28, AC-6)
-- `pcm.funcionarios` é a promoção editável do cache read-only `pcm.tecnicos_cache`.
-- A inversão é intencional: `pcm:leitura` só lê; `pcm:escrita` cria/edita/desativa.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000281', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'func-leitura-s28@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000282', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'func-escrita-s28@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000281","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.funcionarios (nome, created_by) values ('Funcionário negado', '00000000-0000-0000-0000-000000000281') $$,
  '42501',
  null,
  'pcm leitura NAO insere funcionarios'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000282","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.funcionarios (id, nome, auvo_user_id, auvo_id, created_by, updated_by) values ('28000000-0000-0000-0000-000000000001', 'Funcionário S28', 280001, 280001, '00000000-0000-0000-0000-000000000282', '00000000-0000-0000-0000-000000000282') $$,
  'pcm escrita insere funcionarios'
);
select lives_ok(
  $$ update pcm.funcionarios set cargo = 'Técnico', updated_by = '00000000-0000-0000-0000-000000000282' where id = '28000000-0000-0000-0000-000000000001' $$,
  'pcm escrita edita funcionarios'
);
select lives_ok(
  $$ update pcm.funcionarios set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000282' where id = '28000000-0000-0000-0000-000000000001' $$,
  'pcm escrita desativa funcionarios'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'funcionarios' and row_id = '28000000-0000-0000-0000-000000000001'),
  3,
  'trigger funcionarios enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'funcionarios' and row_id = '28000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de funcionarios registra as operacoes esperadas'
);
reset role;

select * from finish();
rollback;
