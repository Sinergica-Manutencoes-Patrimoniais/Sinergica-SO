-- financeiro_robustez_rls.test.sql — pgTAP (E04-S07, AC-2/AC-3)
-- financeiro.lancamentos_eventos é append-only (INSERT só, NUNCA update/delete, nem superadmin) e
-- financeiro.transferencias + fn_criar_transferencia seguem o mesmo gate de user_modulos.financeiro
-- do resto do módulo (padrão de 0079_E01-S54_despesas_auvo.sql). Rodar com `supabase test db`
-- (requer Docker/Supabase local).

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000451', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-sem-modulo-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000452', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000453', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000454', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-superadmin-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;

-- setup: duas contas bancárias como escrita financeiro, para a transferência
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000453","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
insert into financeiro.contas_bancarias (id, nome, saldo_inicial_centavos, saldo_inicial_em)
values
  ('40000000-0000-0000-0000-000000000010', 'Conta origem S07', 1000000, current_date),
  ('40000000-0000-0000-0000-000000000011', 'Conta destino S07', 0, current_date)
on conflict (id) do nothing;

-- 1) sem modulo financeiro: fn_criar_transferencia nega (RLS FORCE nos inserts internos)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000451","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  $$ select financeiro.fn_criar_transferencia(
       '40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000011', 5000, current_date, 'teste'
     ) $$,
  '42501',
  null,
  'sem modulo financeiro NAO cria transferencia'
);

-- 2) leitura: enxerga contas mas não cria transferência
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000452","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ select financeiro.fn_criar_transferencia(
       '40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000011', 5000, current_date, 'teste'
     ) $$,
  '42501',
  null,
  'leitura financeiro NAO cria transferencia'
);

-- 3) escrita: cria a transferência (2 lançamentos + vínculo, atômico)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000453","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ select financeiro.fn_criar_transferencia(
       '40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000011', 5000, current_date, 'teste'
     ) $$,
  'escrita financeiro cria transferencia entre contas'
);
select is(
  (select count(*)::int from financeiro.transferencias
     where conta_origem_id = '40000000-0000-0000-0000-000000000010'
       and conta_destino_id = '40000000-0000-0000-0000-000000000011'),
  1,
  'transferencia gravada em financeiro.transferencias'
);
select is(
  (select count(*)::int from financeiro.lancamentos where origem = 'transferencia'),
  2,
  'transferencia gera par de lancamentos com origem=transferencia'
);

-- 4) mesma conta na origem/destino é rejeitada pela função (defesa em profundidade)
select throws_ok(
  $$ select financeiro.fn_criar_transferencia(
       '40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 5000, current_date, 'teste'
     ) $$,
  '22023',
  'Conta de origem e destino não podem ser a mesma.',
  'transferencia com origem=destino é rejeitada'
);

-- 5) lancamentos_eventos: escrita insere evento de auditoria
select lives_ok(
  $$ insert into financeiro.lancamentos_eventos (lancamento_id, tipo, campo, valor_anterior, valor_novo)
     select id, 'correcao', 'valor_centavos', '1000', '2000' from financeiro.lancamentos limit 1 $$,
  'escrita financeiro insere evento de auditoria (correcao)'
);

-- 6) append-only: NINGUÉM atualiza ou apaga evento de auditoria — nem escrita, nem superadmin
select throws_ok(
  $$ update financeiro.lancamentos_eventos set campo = 'outro' where true $$,
  '42501',
  null,
  'escrita financeiro NAO atualiza evento de auditoria (sem policy de update)'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000454","user_role":"superadmin"}';
select throws_ok(
  $$ delete from financeiro.lancamentos_eventos $$,
  '42501',
  null,
  'superadmin tambem NAO apaga evento de auditoria (append-only, sem excecao de papel)'
);
select ok(
  (select count(*)::int from financeiro.lancamentos_eventos) > 0,
  'superadmin sem claim de financeiro ainda enxerga eventos de auditoria (bypass de leitura)'
);

reset role;
select * from finish();
rollback;
