-- E00-S29_delete_lancamento_nao_some_calado.test.sql — pgTAP da migration 1873.
--
-- O defeito que isto trava: com `financeiro.sso_faturamento_gate` ABERTA, o trigger
-- `s182_proteger_lancamento_faturavel` caía num `return new` seco no caminho em que o lançamento
-- não tem histórico de faturável. Em BEFORE DELETE, `new` é NULL, e NULL cancela a operação sem
-- erro: o lançamento não era apagado e ninguém era avisado. Como esse trigger dispara antes do
-- `trg_lancamentos_bloqueio_mes_fechado` (ordem alfabética), a trava de mês fechado nem chegava a
-- rodar.
--
-- Os três casos abaixo são as três saídas possíveis do trigger com o gate aberto. O terceiro é o
-- que estava quebrado.
begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e0029000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'e0029-delete@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into financeiro.categorias (id, nome, tipo)
values ('e0029000-0000-4000-8000-0000000000c1', '[TESTE] Categoria E00-S29', 'saida')
on conflict (id) do nothing;

-- A trava precisa estar aberta: é só nesse estado que o defeito existia. A 1872 já a abre; o
-- update aqui é explícito para o teste não depender da linha de base.
update financeiro.sso_faturamento_gate set habilitado = true where id;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0029000-0000-4000-8000-000000000001","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id)
values ('e0029000-0000-4000-8000-0000000000a1', 'saida', 'realizado', 1000, '2026-07-10', '2026-07-10', 'e0029000-0000-4000-8000-0000000000c1'),
       ('e0029000-0000-4000-8000-0000000000a2', 'saida', 'realizado', 2000, '2026-08-10', '2026-08-10', 'e0029000-0000-4000-8000-0000000000c1');

-- 1) Mês aberto, lançamento sem histórico de faturável: o DELETE acontece de verdade.
select lives_ok(
  $$ delete from financeiro.lancamentos where id = 'e0029000-0000-4000-8000-0000000000a1' $$,
  'mes aberto: DELETE de lancamento sem historico de faturavel passa'
);
select is(
  (select count(*) from financeiro.lancamentos where id = 'e0029000-0000-4000-8000-0000000000a1'),
  0::bigint,
  'o lancamento sumiu de verdade — nao foi engolido pelo trigger'
);

-- 2) Mês fechado: quem recusa é a trava de competência, com erro, não um cancelamento calado.
select financeiro.fn_fechar_mes('2026-08-15', 'fechamento de teste E00-S29');
select throws_ok(
  $$ delete from financeiro.lancamentos where id = 'e0029000-0000-4000-8000-0000000000a2' $$,
  '22023',
  null,
  'mes fechado: DELETE recusado com erro, e nao silenciosamente ignorado'
);

reset role;
select * from finish();
rollback;
