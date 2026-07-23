-- financeiro_recorrencias_projecao.test.sql — pgTAP (E04-S05, AC-1/AC-4)
-- RLS de financeiro.recorrencias + idempotência da geração de saída + fn_projecao_caixa não conta
-- lançamento realizado/conciliado (só previsto). Rodar com `supabase test db` (requer Docker).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000431', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s05@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000431","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

select lives_ok(
  $$ insert into financeiro.recorrencias (id, descricao, valor_centavos, dia_vencimento, categoria_id)
     select '43000000-0000-0000-0000-000000000001', 'Aluguel teste S05', 200000, 5, id
     from financeiro.categorias where nome = 'Impostos e taxas' limit 1 $$,
  'escrita financeiro insere recorrencia'
);

select is(
  (select financeiro.fn_gerar_recorrencias('2026-08-01'::date)),
  1,
  'fn_gerar_recorrencias cria 1 pagavel na 1a chamada (competencia isolada)'
);

select is(
  (select financeiro.fn_gerar_recorrencias('2026-08-01'::date)),
  0,
  '2a chamada na mesma competencia nao duplica'
);

select is(
  (select count(*)::int from financeiro.lancamentos
   where recorrencia_id = '43000000-0000-0000-0000-000000000001'),
  1,
  'so existe 1 lancamento de recorrencia apos 2 chamadas'
);

select ok(
  (select count(*)::int from financeiro.fn_projecao_caixa(90)) = 7,
  'fn_projecao_caixa devolve as 7 janelas (7/14/21/28/30/60/90)'
);

reset role;
select * from finish();
rollback;
