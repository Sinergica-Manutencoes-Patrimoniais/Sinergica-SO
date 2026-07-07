-- tickets_rls.test.sql — pgTAP (E01-S33, AC-6)
-- Tickets: sem DELETE documentado no Auvo; update/delete locais ainda enfileiram para o drain
-- resolver conforme descriptor (deleteStrategy:'unsupported', toAuvoUpdate restrito a statusId).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tkt-leitura-s33@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tkt-escrita-s33@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000331","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.tickets (titulo, created_by) values ('Ticket negado', '00000000-0000-0000-0000-000000000331') $$,
  '42501',
  null,
  'pcm leitura NAO insere tickets'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000332","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.tickets (id, titulo, status_id, auvo_id, created_by, updated_by) values ('33000000-0000-0000-0000-000000000001', 'Ticket S33', 1, 330001, '00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000332') $$,
  'pcm escrita insere tickets'
);
select lives_ok(
  $$ update pcm.tickets set status_id = 2, updated_by = '00000000-0000-0000-0000-000000000332' where id = '33000000-0000-0000-0000-000000000001' $$,
  'pcm escrita muda status do ticket'
);
select lives_ok(
  $$ update pcm.tickets set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000332' where id = '33000000-0000-0000-0000-000000000001' $$,
  'pcm escrita arquiva ticket localmente'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'tickets' and row_id = '33000000-0000-0000-0000-000000000001'),
  3,
  'trigger tickets enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'tickets' and row_id = '33000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de tickets registra operacoes que o drain resolve conforme descriptor'
);
reset role;

select * from finish();
rollback;
