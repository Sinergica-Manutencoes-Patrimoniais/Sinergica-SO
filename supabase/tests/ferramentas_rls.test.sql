-- ferramentas_rls.test.sql — pgTAP (E01-S30, AC-7)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-leitura-s30@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-escrita-s30@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.ferramentas (nome, created_by) values ('Ferramenta negada', '00000000-0000-0000-0000-000000000301') $$,
  '42501',
  null,
  'pcm leitura NAO insere ferramentas'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.ferramentas (id, nome, quantidade_total, quantidade_minima, auvo_id, created_by, updated_by) values ('30000000-0000-0000-0000-000000000001', 'Ferramenta S30', 4, 1, 300001, '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000302') $$,
  'pcm escrita insere ferramentas'
);
select lives_ok(
  $$ update pcm.ferramentas set quantidade_minima = 2, updated_by = '00000000-0000-0000-0000-000000000302' where id = '30000000-0000-0000-0000-000000000001' $$,
  'pcm escrita edita ferramentas'
);
select lives_ok(
  $$ update pcm.ferramentas set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000302' where id = '30000000-0000-0000-0000-000000000001' $$,
  'pcm escrita desativa ferramentas'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'ferramentas' and row_id = '30000000-0000-0000-0000-000000000001'),
  3,
  'trigger ferramentas enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'ferramentas' and row_id = '30000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de ferramentas registra as operacoes esperadas'
);
reset role;

select * from finish();
rollback;
