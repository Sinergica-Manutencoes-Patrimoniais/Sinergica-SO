-- financeiro_contratos_recebiveis.test.sql — pgTAP (E04-S04, AC-2/AC-4)
-- RLS de financeiro.contratos + idempotência de fn_gerar_recorrencias.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- cliente de teste (pcm.clientes) — necessário pra FK de contratos
insert into pcm.clientes (id, nome)
values ('41000000-0000-0000-0000-000000000001', 'Cliente teste S04')
on conflict (id) do nothing;

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000411","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ insert into financeiro.contratos (cliente_id, valor_mensal_centavos, dia_vencimento, inicio)
     values ('41000000-0000-0000-0000-000000000001', 100000, 10, current_date) $$,
  '42501',
  null,
  'leitura financeiro NAO insere contrato'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000412","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ insert into financeiro.contratos (id, cliente_id, valor_mensal_centavos, dia_vencimento, inicio, status)
     values ('41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 150000, 10, '2026-01-01', 'ativo') $$,
  'escrita financeiro insere contrato'
);

-- 1ª geração: cria 1 recebível
select is(
  (select financeiro.fn_gerar_recorrencias('2026-07-01'::date)),
  1,
  'fn_gerar_recorrencias cria 1 recebivel na 1a chamada'
);

-- 2ª geração (mesma competência): idempotente, não duplica
select is(
  (select financeiro.fn_gerar_recorrencias('2026-07-01'::date)),
  0,
  'fn_gerar_recorrencias na 2a chamada nao duplica (idempotente)'
);

select is(
  (select count(*)::int from financeiro.lancamentos
   where contrato_id = '41000000-0000-0000-0000-000000000002' and origem = 'recorrencia'),
  1,
  'so existe 1 lancamento de recorrencia para o contrato apos 2 chamadas'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000411","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select ok(
  (select count(*)::int from financeiro.aging_recebiveis
   where cliente_id = '41000000-0000-0000-0000-000000000001') >= 1,
  'aging_recebiveis mostra o recebivel gerado pra quem tem leitura financeiro'
);

reset role;
select * from finish();
rollback;
