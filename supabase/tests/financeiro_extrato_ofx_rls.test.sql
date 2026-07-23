-- financeiro_extrato_ofx_rls.test.sql — pgTAP (E04-S02, AC-2)
-- RLS de financeiro.extrato_transacoes/regras_classificacao + unique (conta_id, fitid).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s02@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s02@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000422","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

select lives_ok(
  $$ insert into financeiro.contas_bancarias (id, nome, saldo_inicial_centavos, saldo_inicial_em)
     values ('42000000-0000-0000-0000-000000000001', 'Conta teste S02', 0, current_date) $$,
  'escrita financeiro insere conta bancaria'
);

select lives_ok(
  $$ insert into financeiro.extrato_transacoes (id, conta_id, fitid, data, valor_centavos, memo)
     values ('42000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'FIT001', current_date, -1000, 'Teste') $$,
  'escrita financeiro insere transacao de extrato'
);

select throws_ok(
  $$ insert into financeiro.extrato_transacoes (conta_id, fitid, data, valor_centavos)
     values ('42000000-0000-0000-0000-000000000001', 'FIT001', current_date, -1000) $$,
  '23505',
  null,
  'reimportar mesmo FITID na mesma conta viola unique (dedupe)'
);

select lives_ok(
  $$ insert into financeiro.extrato_transacoes (conta_id, fitid, data, valor_centavos)
     values ('42000000-0000-0000-0000-000000000001', 'FIT001', current_date, -1000)
     on conflict (conta_id, fitid) do nothing $$,
  'reimport com on conflict do nothing nao quebra (idempotente)'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000421","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ insert into financeiro.regras_classificacao (padrao) values ('teste negado') $$,
  '42501',
  null,
  'leitura financeiro NAO insere regra de classificacao'
);

reset role;
select * from finish();
rollback;
