-- financeiro_dre_orcamento_rls.test.sql — pgTAP (E04-S12, AC-1/AC-2/AC-3)
-- RLS de financeiro.orcamentos + fn_dre_mensal soma por competência/grupo + fn_orcamento_realizado
-- traz categoria sem orçamento (edge case: só realizado, tem_orcamento=false).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s12@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s12@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into financeiro.categorias (id, nome, tipo)
values
  ('40000000-0000-0000-0000-000000000060', 'Categoria receita S12', 'entrada'),
  ('40000000-0000-0000-0000-000000000061', 'Categoria despesa S12', 'saida')
on conflict (id) do nothing;
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
values
  ('40000000-0000-0000-0000-000000000062', 'entrada', 'realizado', 500000, '2026-06-10', '2026-06-10', '40000000-0000-0000-0000-000000000060'),
  ('40000000-0000-0000-0000-000000000063', 'saida', 'realizado', 200000, '2026-06-10', '2026-06-10', '40000000-0000-0000-0000-000000000061')
on conflict (id) do nothing;

set local role authenticated;

-- 1) leitura NAO grava orçamento
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ insert into financeiro.orcamentos (categoria_id, competencia, valor_centavos)
     values ('40000000-0000-0000-0000-000000000061', '2026-06-01', 150000) $$,
  '42501',
  null,
  'leitura financeiro NAO grava orcamento'
);

-- 2) fn_dre_mensal soma receita/despesa por competência (AC-1)
select is(
  (select valor_centavos from financeiro.fn_dre_mensal(3) where mes = '2026-06-01' and tipo = 'entrada' limit 1),
  500000::bigint,
  'fn_dre_mensal soma receita de junho/2026'
);
select is(
  (select valor_centavos from financeiro.fn_dre_mensal(3) where mes = '2026-06-01' and tipo = 'saida' limit 1),
  200000::bigint,
  'fn_dre_mensal soma despesa de junho/2026'
);

-- 3) escrita grava orçamento pra despesa S12 em julho/2026
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ insert into financeiro.orcamentos (categoria_id, competencia, valor_centavos)
     values ('40000000-0000-0000-0000-000000000061', '2026-06-01', 150000) $$,
  'escrita financeiro grava orcamento'
);

-- 4) fn_orcamento_realizado: categoria COM orçamento mostra tem_orcamento=true; categoria receita
-- (sem orçamento, só realizado) aparece com tem_orcamento=false — edge case AC-3.
select is(
  (select tem_orcamento from financeiro.fn_orcamento_realizado(2026)
     where categoria_id = '40000000-0000-0000-0000-000000000061' and mes = '2026-06-01'),
  true,
  'categoria com orcamento: tem_orcamento=true'
);
select is(
  (select tem_orcamento from financeiro.fn_orcamento_realizado(2026)
     where categoria_id = '40000000-0000-0000-0000-000000000060' and mes = '2026-06-01'),
  false,
  'categoria SEM orcamento (so realizado): tem_orcamento=false (edge case AC-3)'
);

reset role;
select * from finish();
rollback;
