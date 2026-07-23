-- financeiro_fechamento_mensal_rls.test.sql — pgTAP (E04-S11, AC-2/AC-3)
-- Trigger de bloqueio em mês fechado (vale pra escrita/service_role) + RPCs fn_fechar_mes (qualquer
-- financeiro:escrita) e fn_reabrir_mes (só superadmin, motivo obrigatório, auditável).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000491', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s11@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000492', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-superadmin-s11@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into financeiro.categorias (id, nome, tipo)
values ('40000000-0000-0000-0000-000000000050', 'Categoria teste S11', 'saida')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000491","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

-- 1) antes de fechar: escrita normal funciona
select lives_ok(
  $$ insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
     values ('40000000-0000-0000-0000-000000000051', 'saida', 'realizado', 1000, '2026-05-10', '2026-05-10', '40000000-0000-0000-0000-000000000050') $$,
  'antes do fechamento: escrita normal em maio/2026 funciona'
);

-- 2) fecha maio/2026 (qualquer financeiro:escrita)
select lives_ok(
  $$ select financeiro.fn_fechar_mes('2026-05-15', 'revisão concluída') $$,
  'financeiro:escrita fecha o mes'
);
select is(
  (select status from financeiro.fechamentos_mensais where competencia = '2026-05-01'),
  'fechado',
  'competencia fica com status fechado'
);

-- 3) mês fechado bloqueia INSERT/UPDATE/DELETE — AC-2
select throws_ok(
  $$ insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
     values ('saida', 'realizado', 500, '2026-05-20', '2026-05-20', '40000000-0000-0000-0000-000000000050') $$,
  '22023',
  null,
  'mes fechado bloqueia INSERT novo (mesma competencia)'
);
select throws_ok(
  $$ update financeiro.lancamentos set valor_centavos = 2000 where id = '40000000-0000-0000-0000-000000000051' $$,
  '22023',
  null,
  'mes fechado bloqueia UPDATE de lancamento existente'
);
select throws_ok(
  $$ delete from financeiro.lancamentos where id = '40000000-0000-0000-0000-000000000051' $$,
  '22023',
  null,
  'mes fechado bloqueia DELETE'
);

-- 4) financeiro:escrita (não superadmin) NAO reabre
select throws_ok(
  $$ select financeiro.fn_reabrir_mes('2026-05-01', 'teste') $$,
  '42501',
  null,
  'financeiro:escrita (nao superadmin) NAO reabre mes'
);

-- 5) superadmin reabre com motivo — volta a aceitar escrita
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000492","user_role":"superadmin"}';
select financeiro.fn_reabrir_mes('2026-05-01', 'ajuste retroativo solicitado pelo contador');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000491","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ update financeiro.lancamentos set valor_centavos = 2000 where id = '40000000-0000-0000-0000-000000000051' $$,
  'depois de reaberto (superadmin, com motivo): escrita volta a funcionar'
);

reset role;
select * from finish();
rollback;
