-- atendimento_personas_rls.test.sql — pgTAP (E02-S06)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000361', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-personas-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000362', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-personas-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000361","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.personas (nome, tipo, prompt_sistema, created_by) values ('Comercial - Teste', 'comercial', 'prompt', '00000000-0000-0000-0000-000000000361') $$,
  '42501',
  null,
  'atendimento leitura NAO cria persona'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000362","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.personas (id, nome, tipo, prompt_sistema, created_by) values ('36000000-0000-0000-0000-000000000001', 'Comercial - Teste', 'comercial', 'prompt', '00000000-0000-0000-0000-000000000362') $$,
  'atendimento escrita cria persona'
);
select throws_ok(
  $$ insert into atendimento.personas (nome, tipo, prompt_sistema, created_by) values ('Invalida', 'suporte', 'prompt', '00000000-0000-0000-0000-000000000362') $$,
  '23514',
  null,
  'tipo fora de chamados/comercial e rejeitado pelo check'
);
select lives_ok(
  $$ insert into atendimento.instancias_agente (instance_id, persona_id, created_by) values ('inst-comercial-1', '36000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000362') $$,
  'atendimento escrita mapeia instancia pro agente'
);
reset role;

-- Sem o módulo `atendimento`, o SELECT continua permitido a nível de ACL, mas a policy filtra por
-- linha — resultado é conjunto vazio, não exceção.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000361","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.personas where id = '36000000-0000-0000-0000-000000000001'),
  0,
  'sem modulo atendimento NAO ve a persona criada (RLS filtra a linha, nao lanca erro)'
);
reset role;

select * from finish();
rollback;
