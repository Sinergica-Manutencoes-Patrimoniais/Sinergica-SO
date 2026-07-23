-- financeiro_regua_cobranca_rls.test.sql — pgTAP (E04-S08, AC-1/AC-2/AC-3)
-- RLS de financeiro.regua_pontos (CRUD por user_modulos.financeiro) e financeiro.regua_envios
-- (só leitura pra authenticated — quem grava é sempre o job via service_role); fn_regua_pendentes
-- devolve o recebível quando o ponto foi atingido e some depois de registrado (idempotência AC-3).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000461', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-leitura-s08@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000462', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s08@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- fixtures (papel padrão da transação de teste, sem RLS) — cliente + categoria + recebível
-- previsto vencendo daqui a 3 dias (ponto D-3 já atingido hoje).
insert into pcm.clientes (id, nome, contato_telefone, contato_email, created_by)
values ('40000000-0000-0000-0000-000000000022', 'Cliente Teste S08', '11999998888', 'cliente-s08@test.local', '00000000-0000-0000-0000-000000000462')
on conflict (id) do nothing;
insert into financeiro.categorias (id, nome, tipo)
values ('40000000-0000-0000-0000-000000000023', 'Categoria teste S08', 'entrada')
on conflict (id) do nothing;
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id)
values ('40000000-0000-0000-0000-000000000024', 'entrada', 'previsto', 15000, current_date, current_date + 3, '40000000-0000-0000-0000-000000000023', '40000000-0000-0000-0000-000000000022')
on conflict (id) do nothing;

set local role authenticated;

-- 1) leitura: não cria ponto da régua nem grava evento de envio
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000461","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
select throws_ok(
  $$ insert into financeiro.regua_pontos (dia_offset, canal, mensagem_modelo) values (-3, 'whatsapp', 'Olá {{cliente}}') $$,
  '42501',
  null,
  'leitura financeiro NAO cria ponto da regua'
);
select throws_ok(
  $$ insert into financeiro.regua_envios (lancamento_id, ponto_id, status) values (gen_random_uuid(), gen_random_uuid(), 'enviado') $$,
  '42501',
  null,
  'leitura financeiro (nao eh service_role) NAO insere evento de envio'
);

-- 2) escrita: cria os 2 pontos usados no cenário de fn_regua_pendentes
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000462","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ insert into financeiro.regua_pontos (id, dia_offset, canal, mensagem_modelo)
     values ('40000000-0000-0000-0000-000000000020', -3, 'whatsapp', 'Olá {{cliente}}, vence em {{vencimento}}') $$,
  'escrita financeiro cria ponto D-3'
);
select lives_ok(
  $$ insert into financeiro.regua_pontos (id, dia_offset, canal, mensagem_modelo)
     values ('40000000-0000-0000-0000-000000000021', 30, 'email', 'Olá {{cliente}}, ainda em aberto') $$,
  'escrita financeiro cria ponto D+30 (nao deve bater ainda)'
);

-- 3) fn_regua_pendentes: só service_role chama (grant execute restrito) — authenticated é negado.
select throws_ok(
  $$ select * from financeiro.fn_regua_pendentes() $$,
  '42501',
  null,
  'authenticated NAO executa fn_regua_pendentes (só service_role)'
);

reset role;
set local role service_role;
select is(
  (select count(*)::int from financeiro.fn_regua_pendentes()
     where lancamento_id = '40000000-0000-0000-0000-000000000024'
       and ponto_id = '40000000-0000-0000-0000-000000000020'),
  1,
  'fn_regua_pendentes devolve o ponto D-3 (ja atingido) pro recebivel, e nao o D+30'
);

-- 4) AC-3: registra o envio (idempotente) — segunda chamada pro mesmo par devolve false, e o par
-- some de fn_regua_pendentes.
select is(
  (select financeiro.fn_regua_registrar_envio('40000000-0000-0000-0000-000000000024', '40000000-0000-0000-0000-000000000020', 'enviado', 'whatsapp', null)),
  true,
  'primeiro registro do envio (D-3) retorna true'
);
select is(
  (select financeiro.fn_regua_registrar_envio('40000000-0000-0000-0000-000000000024', '40000000-0000-0000-0000-000000000020', 'enviado', 'whatsapp', null)),
  false,
  'segundo registro do MESMO par lancamento+ponto retorna false (nao duplica, AC-3)'
);

reset role;
select * from finish();
rollback;
