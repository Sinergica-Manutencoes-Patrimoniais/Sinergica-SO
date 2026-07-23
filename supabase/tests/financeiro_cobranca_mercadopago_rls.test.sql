-- financeiro_cobranca_mercadopago_rls.test.sql — pgTAP (E04-S09, AC-1/AC-2/AC-3)
-- RLS de financeiro.cobrancas/cobrancas_eventos (só leitura pra authenticated — emissão/baixa
-- sempre via Edge Function com service_role, nunca escrita direta do client) + dedupe de evento por
-- `evento_externo_id` (idempotência real do webhook/reconciliação fica no unique constraint).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000471', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s09@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- fixtures (papel padrão da transação, sem RLS)
insert into pcm.clientes (id, nome, contato_email, cnpj, created_by)
values ('40000000-0000-0000-0000-000000000030', 'Cliente Teste S09', 'cliente-s09@test.local', '12345678000199', '00000000-0000-0000-0000-000000000471')
on conflict (id) do nothing;
insert into financeiro.categorias (id, nome, tipo)
values ('40000000-0000-0000-0000-000000000031', 'Categoria teste S09', 'entrada')
on conflict (id) do nothing;
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id)
values ('40000000-0000-0000-0000-000000000032', 'entrada', 'previsto', 25000, current_date, current_date + 10, '40000000-0000-0000-0000-000000000031', '40000000-0000-0000-0000-000000000030')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000471","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

-- 1) escrita financeiro (usuário comum) NAO insere cobrança direto — só a Edge Function
-- (service_role) pode, mesmo com módulo de escrita (evita status de pagamento forjado no browser).
select throws_ok(
  $$ insert into financeiro.cobrancas (lancamento_id, tipo, external_id, valor_centavos)
     values ('40000000-0000-0000-0000-000000000032', 'pix', 'mp-ext-001', 25000) $$,
  '42501',
  null,
  'escrita financeiro (authenticated) NAO insere cobranca direto — só service_role'
);
select is(
  (select count(*)::int from financeiro.cobrancas),
  0,
  'nenhuma cobranca criada pela tentativa negada'
);

reset role;
set local role service_role;

-- 2) service_role (Edge Function) cria a cobrança normalmente
select lives_ok(
  $$ insert into financeiro.cobrancas (id, lancamento_id, tipo, external_id, valor_centavos)
     values ('40000000-0000-0000-0000-000000000033', '40000000-0000-0000-0000-000000000032', 'pix', 'mp-ext-001', 25000) $$,
  'service_role cria cobranca (fluxo real: Edge Function financeiro-cobranca-emitir)'
);

-- 3) AC-3: dedupe de evento por evento_externo_id — segunda tentativa do MESMO (id, status) do
-- Mercado Pago não duplica (webhook reenviado ou reconciliação batendo no que o webhook já fez).
select lives_ok(
  $$ insert into financeiro.cobrancas_eventos (cobranca_id, evento_externo_id, origem, status_recebido)
     values ('40000000-0000-0000-0000-000000000033', 'mp-ext-001:pago', 'webhook', 'approved') $$,
  'primeiro evento (pago) registrado'
);
select throws_ok(
  $$ insert into financeiro.cobrancas_eventos (cobranca_id, evento_externo_id, origem, status_recebido)
     values ('40000000-0000-0000-0000-000000000033', 'mp-ext-001:pago', 'reconciliacao', 'approved') $$,
  '23505',
  null,
  'evento duplicado (mesmo id+status) é rejeitado pelo unique constraint — dedupe real, não side-effect'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000471","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';

-- 4) leitura funciona normal pra quem tem módulo financeiro (só a ESCRITA é bloqueada)
select is(
  (select count(*)::int from financeiro.cobrancas where id = '40000000-0000-0000-0000-000000000033'),
  1,
  'escrita financeiro consegue LER a cobranca criada pelo job'
);

reset role;
select * from finish();
rollback;
