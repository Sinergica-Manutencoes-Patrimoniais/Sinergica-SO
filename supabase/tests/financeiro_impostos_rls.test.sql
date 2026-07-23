-- financeiro_impostos_rls.test.sql — pgTAP (E04-S10, AC-1/AC-2/AC-4)
-- RLS de financeiro.config_impostos (singleton) + financeiro.provisoes_imposto; fn_provisionar_imposto
-- calcula a partir da receita real de lançamentos e é idempotente/recalcula numa retificação.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000481', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s10@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000482', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s10@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- fixture: receita de entrada na competência de teste (papel padrão, sem RLS)
insert into financeiro.categorias (id, nome, tipo)
values ('40000000-0000-0000-0000-000000000040', 'Categoria receita teste S10', 'entrada')
on conflict (id) do nothing;
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
values ('40000000-0000-0000-0000-000000000041', 'entrada', 'realizado', 1_000_000, '2026-03-15', '2026-03-15', '40000000-0000-0000-0000-000000000040')
on conflict (id) do nothing;

set local role authenticated;

-- 1) sem config: fn_provisionar_imposto avisa (nunca inventa taxa) — AC "Alíquota não configurada"
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000482","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select throws_ok(
  $$ select * from financeiro.fn_provisionar_imposto('2026-03-01') $$,
  '22023',
  'Configuração de impostos não definida ou inativa (Configurações > Impostos).',
  'sem config de impostos: fn_provisionar_imposto avisa, nao inventa taxa'
);

-- 2) leitura NAO configura impostos
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000481","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ insert into financeiro.config_impostos (id, tipo, aliquota_fixa) values (1, 'fixa', 0.06) $$,
  '42501',
  null,
  'leitura financeiro NAO configura impostos'
);

-- 3) escrita configura alíquota fixa de 6%
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000482","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ insert into financeiro.config_impostos (id, tipo, aliquota_fixa, dia_vencimento) values (1, 'fixa', 0.06, 20) $$,
  'escrita financeiro configura aliquota fixa 6%'
);

-- 4) provisiona: receita 10.000,00 * 6% = 600,00 (60000 centavos)
select is(
  (select valor_centavos from financeiro.fn_provisionar_imposto('2026-03-01')),
  60000::bigint,
  'provisiona 6% de R$10.000,00 = R$600,00'
);
select is(
  (select count(*)::int from financeiro.lancamentos where tipo = 'saida' and data_competencia = '2026-03-01'
     and categoria_id in (select id from financeiro.categorias where nome = 'Impostos e taxas')),
  1,
  'cria 1 pagavel previsto de imposto pra competencia'
);

-- 5) AC "retificação recalcula": muda a alíquota pra 8% e reprovisiona a MESMA competência —
-- atualiza o pagável existente em vez de duplicar (idempotente).
update financeiro.config_impostos set aliquota_fixa = 0.08 where id = 1;
select is(
  (select valor_centavos from financeiro.fn_provisionar_imposto('2026-03-01')),
  80000::bigint,
  'retificacao: recalcula pra 8% = R$800,00'
);
select is(
  (select count(*)::int from financeiro.provisoes_imposto where competencia = '2026-03-01'),
  1,
  'ainda so 1 linha de provisao pra competencia (recalculo, nao duplicacao)'
);

reset role;
select * from finish();
rollback;
