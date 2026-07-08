-- atendimento_evolution_rls.test.sql — pgTAP (E02-S19, AC-1..AC-3)
-- Rodar com `supabase test db` (requer Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-evolution-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000392', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-evolution-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000391","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.canais_externos (tipo, label, identificador_externo, created_by) values ('evolution', 'Leitura', 'evo-leitura', '00000000-0000-0000-0000-000000000391') $$,
  '42501',
  null,
  'atendimento leitura NAO cria instancia Evolution'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000392","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.canais_externos (id, tipo, label, identificador_externo, numero_vinculado, created_by) values ('39000000-0000-0000-0000-000000000001', 'evolution', 'Atendimento', 'evo-atendimento', '5511999990000', '00000000-0000-0000-0000-000000000392') $$,
  'atendimento escrita cria instancia Evolution com numero vinculado'
);
select throws_ok(
  $$ insert into atendimento.canais_externos (tipo, label, identificador_externo, created_by) values ('evolution', 'Duplicada', 'evo-atendimento', '00000000-0000-0000-0000-000000000392') $$,
  '23505',
  null,
  'Instance ID Evolution ativo nao duplica'
);
select lives_ok(
  $$
    insert into atendimento.personas (id, nome, tipo, prompt_sistema, created_by)
      values ('39000000-0000-0000-0000-000000000002', 'Comercial Evolution', 'comercial', 'prompt', '00000000-0000-0000-0000-000000000392');
    insert into atendimento.instancias_agente (instance_id, persona_id, created_by)
      values ('evo-atendimento', '39000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000392');
  $$,
  'vinculo instance_id para persona continua compativel'
);
select lives_ok(
  $$ update atendimento.canais_externos set status_conexao = 'conectado', updated_by = '00000000-0000-0000-0000-000000000392' where id = '39000000-0000-0000-0000-000000000001' $$,
  'atendimento escrita atualiza snapshot real de conexao'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000391","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.canais_externos where id = '39000000-0000-0000-0000-000000000001'),
  0,
  'sem modulo atendimento NAO ve a instancia Evolution'
);
reset role;

select * from finish();
rollback;
