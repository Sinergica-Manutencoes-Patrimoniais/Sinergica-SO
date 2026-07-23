-- financeiro_fundacao_rls.test.sql — pgTAP (E04-S01, AC-1)
-- RLS FORCE de financeiro.categorias/contas_bancarias/lancamentos gateada por
-- user_modulos.financeiro (padrão de 0079_E01-S54_despesas_auvo.sql).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-sem-modulo-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-superadmin-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;

-- 1) sem `financeiro` em user_modulos: select não enxerga nada (RLS FORCE nega, sem erro)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from financeiro.categorias),
  0,
  'sem modulo financeiro: select de categorias retorna zero linhas'
);

-- 2) leitura: enxerga o seed do plano de contas (>=1), mas não pode inserir
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000402","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select ok(
  (select count(*)::int from financeiro.categorias) > 0,
  'leitura financeiro: select de categorias enxerga o seed'
);
select throws_ok(
  $$ insert into financeiro.categorias (nome, tipo) values ('Categoria negada', 'saida') $$,
  '42501',
  null,
  'leitura financeiro NAO insere categoria'
);
select throws_ok(
  $$ insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
     select 'saida', 'realizado', 100, current_date, current_date, id from financeiro.categorias limit 1 $$,
  '42501',
  null,
  'leitura financeiro NAO insere lancamento'
);

-- 3) escrita: CRUD completo nas 3 tabelas + regra de domínio no banco (defesa em profundidade)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000403","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ insert into financeiro.categorias (id, nome, tipo)
     values ('40000000-0000-0000-0000-000000000001', 'Categoria teste S01', 'saida') $$,
  'escrita financeiro insere categoria'
);
select lives_ok(
  $$ insert into financeiro.contas_bancarias (id, nome, saldo_inicial_centavos, saldo_inicial_em)
     values ('40000000-0000-0000-0000-000000000002', 'Conta teste S01', 100000, current_date) $$,
  'escrita financeiro insere conta bancaria'
);
select lives_ok(
  $$ insert into financeiro.lancamentos
       (id, tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id, conta_id)
     values
       ('40000000-0000-0000-0000-000000000003', 'saida', 'realizado', 5000, current_date, current_date,
        '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002') $$,
  'escrita financeiro insere lancamento realizado valido'
);
select throws_ok(
  $$ insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, categoria_id)
     values ('saida', 'previsto', 5000, current_date, '40000000-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'lancamento previsto sem vencimento viola check constraint (defesa em profundidade)'
);
select lives_ok(
  $$ update financeiro.categorias set ativo = false where id = '40000000-0000-0000-0000-000000000001' $$,
  'escrita financeiro desativa categoria'
);

-- 4) superadmin sem claim de modulo: bypass total (mesmo padrão das demais tabelas do repo)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000404","user_role":"superadmin"}';
select ok(
  (select count(*)::int from financeiro.categorias) > 0,
  'superadmin sem claim de financeiro ainda enxerga categorias (bypass)'
);

reset role;
select * from finish();
rollback;
