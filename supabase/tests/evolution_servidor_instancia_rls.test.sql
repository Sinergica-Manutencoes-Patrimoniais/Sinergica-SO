-- evolution_servidor_instancia_rls.test.sql — pgTAP (E02-S35, AC-9)
-- Caso permitido (superadmin) e negado (colaborador com atendimento=escrita) nas duas tabelas novas.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'super-s35@test.local', crypt('x', gen_salt('bf')), now(),
   '{"user_role":"superadmin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000352', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'colab-s35@test.local', crypt('x', gen_salt('bf')), now(),
   '{"user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}', '{}', now(), now())
on conflict (id) do nothing;

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values ('00000000-0000-0000-0000-000000000353', 'evolution', 'Canal RLS S35', 'teste-s35-rls', true)
on conflict (id) do nothing;

-- superadmin: pode inserir evolution_servidor
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000351","user_role":"superadmin"}';

select lives_ok(
  $$ insert into atendimento.evolution_servidor (url_base, created_by)
     values ('https://evolution.exemplo.com.br', '00000000-0000-0000-0000-000000000351') $$,
  'superadmin insere em evolution_servidor'
);

select lives_ok(
  $$ insert into atendimento.evolution_instancia (canal_id, nome_remoto, created_by)
     values ('00000000-0000-0000-0000-000000000353', 'canal-s35-rls', '00000000-0000-0000-0000-000000000351') $$,
  'superadmin insere em evolution_instancia'
);

select isnt_empty(
  $$ select 1 from atendimento.evolution_servidor $$,
  'superadmin lê evolution_servidor'
);

-- colaborador (não-superadmin): negado nas duas tabelas
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000352","user_role":"colaborador"}';

select is_empty(
  $$ select 1 from atendimento.evolution_servidor $$,
  'colaborador NAO vê evolution_servidor (RLS nega leitura)'
);

select throws_ok(
  $$ insert into atendimento.evolution_servidor (url_base, created_by)
     values ('https://outro.exemplo.com.br', '00000000-0000-0000-0000-000000000352') $$,
  '42501',
  null,
  'colaborador NAO insere em evolution_servidor (RLS nega escrita)'
);

select throws_ok(
  $$ insert into atendimento.evolution_instancia (canal_id, nome_remoto, created_by)
     values ('00000000-0000-0000-0000-000000000353', 'canal-s35-rls-negado', '00000000-0000-0000-0000-000000000352') $$,
  '42501',
  null,
  'colaborador NAO insere em evolution_instancia (RLS nega escrita)'
);

select * from finish();
rollback;
