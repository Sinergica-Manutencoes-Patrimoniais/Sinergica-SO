-- atendimento_tags_rls.test.sql — pgTAP (E02-S05, AC-5)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-tags-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000352', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-tags-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000351","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.tags (nome, created_by) values ('Urgente', '00000000-0000-0000-0000-000000000351') $$,
  '42501',
  null,
  'atendimento leitura NAO cria tag'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000352","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.tags (id, nome, created_by) values ('35000000-0000-0000-0000-000000000001', 'Urgente', '00000000-0000-0000-0000-000000000352') $$,
  'atendimento escrita cria tag'
);
select throws_ok(
  $$ insert into atendimento.tags (nome, created_by) values ('urgente', '00000000-0000-0000-0000-000000000352') $$,
  '23505',
  null,
  'nome duplicado case-insensitive e rejeitado pelo indice unico'
);
select lives_ok(
  $$ update atendimento.tags set ativo = false, updated_by = '00000000-0000-0000-0000-000000000352' where id = '35000000-0000-0000-0000-000000000001' $$,
  'atendimento escrita desativa tag (soft-disable, sem DELETE)'
);
reset role;

-- Sem o módulo `atendimento`, o SELECT continua permitido a nível de ACL, mas a policy filtra por
-- linha — resultado é conjunto vazio, não exceção.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000351","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.tags where id = '35000000-0000-0000-0000-000000000001'),
  0,
  'sem modulo atendimento NAO ve a tag criada (RLS filtra a linha, nao lanca erro)'
);
reset role;

select * from finish();
rollback;
