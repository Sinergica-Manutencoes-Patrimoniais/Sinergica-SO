-- atendimento_fluxos_rls.test.sql — pgTAP (E02-S07)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-fluxos-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000372', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-fluxos-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into atendimento.personas (id, nome, tipo, prompt_sistema, created_by)
values ('37000000-0000-0000-0000-000000000001', 'Comercial - Teste Fluxo', 'comercial', 'prompt', '00000000-0000-0000-0000-000000000372')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000371","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.fluxos (nome, persona_id, created_by) values ('Qualificação', '37000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000371') $$,
  '42501',
  null,
  'atendimento leitura NAO cria fluxo'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000372","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.fluxos (id, nome, persona_id, created_by) values ('37000000-0000-0000-0000-000000000002', 'Qualificação', '37000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000372') $$,
  'atendimento escrita cria fluxo'
);
select lives_ok(
  $$ update atendimento.fluxos set definicao = '[{"id":"p1","campo":"orcamento","pergunta":"Qual o orçamento?","obrigatorio":true,"ordem":0,"x":100,"y":0}]'::jsonb, updated_by = '00000000-0000-0000-0000-000000000372' where id = '37000000-0000-0000-0000-000000000002' $$,
  'atendimento escrita salva definicao (passos) do fluxo'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000371","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.fluxos where id = '37000000-0000-0000-0000-000000000002'),
  0,
  'sem modulo atendimento NAO ve o fluxo criado (RLS filtra a linha, nao lanca erro)'
);
reset role;

select * from finish();
rollback;
