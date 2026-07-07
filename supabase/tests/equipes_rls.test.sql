-- equipes_rls.test.sql — pgTAP (E01-S32, AC-5)
-- Teams não tem PATCH/DELETE no Auvo; update/delete locais ainda enfileiram para o drain marcar no-op.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eqp-leitura-s32@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eqp-escrita-s32@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000321","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.equipes (nome, created_by) values ('Equipe negada', '00000000-0000-0000-0000-000000000321') $$,
  '42501',
  null,
  'pcm leitura NAO insere equipes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000322","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.equipes (id, nome, participantes_auvo_ids, gestores_auvo_ids, auvo_id, created_by, updated_by) values ('32000000-0000-0000-0000-000000000001', 'Equipe S32', array[320001,320002]::bigint[], array[320001]::bigint[], 320001, '00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000322') $$,
  'pcm escrita insere equipes'
);
select lives_ok(
  $$ update pcm.equipes set nome = 'Equipe S32 local', updated_by = '00000000-0000-0000-0000-000000000322' where id = '32000000-0000-0000-0000-000000000001' $$,
  'pcm escrita edita equipes localmente'
);
select lives_ok(
  $$ update pcm.equipes set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000322' where id = '32000000-0000-0000-0000-000000000001' $$,
  'pcm escrita desativa equipes localmente'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'equipes' and row_id = '32000000-0000-0000-0000-000000000001'),
  3,
  'trigger equipes enfileira create/update/delete'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'equipes' and row_id = '32000000-0000-0000-0000-000000000001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de equipes registra operacoes que o drain resolve conforme descriptor'
);
reset role;

select * from finish();
rollback;
