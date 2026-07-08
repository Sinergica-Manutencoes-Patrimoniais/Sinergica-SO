-- atendimento_conversas_rls.test.sql — pgTAP (E02-S01, AC-7)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-leitura-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000342', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-escrita-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000341","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.conversas (instance_id, remote_jid) values ('inst-1', 'jid-negado@g.us') $$,
  '42501',
  null,
  'atendimento leitura NAO insere conversas'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000342","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.conversas (id, instance_id, remote_jid, created_by) values ('34000000-0000-0000-0000-000000000001', 'inst-1', 'jid-s01@g.us', '00000000-0000-0000-0000-000000000342') $$,
  'atendimento escrita insere conversas'
);
select lives_ok(
  $$ update atendimento.conversas set modo = 'pausado', atribuido_a = '00000000-0000-0000-0000-000000000342', updated_by = '00000000-0000-0000-0000-000000000342' where id = '34000000-0000-0000-0000-000000000001' $$,
  'atendimento escrita assume conversa (modo pausado)'
);
reset role;

-- Sem o módulo `atendimento`, o SELECT continua permitido a nível de ACL (grant é amplo pra
-- `authenticated`), mas a policy filtra por linha — resultado é conjunto vazio, não exceção.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000341","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.conversas where id = '34000000-0000-0000-0000-000000000001'),
  0,
  'sem modulo atendimento NAO ve a conversa criada (RLS filtra a linha, nao lanca erro)'
);
reset role;

select * from finish();
rollback;
