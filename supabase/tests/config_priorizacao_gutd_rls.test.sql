-- config_priorizacao_gutd_rls.test.sql — pgTAP (E01-S82 AC-2)
-- `config.priorizacao_gutd` é singleton (id=1): qualquer authenticated LÊ (backlog precisa dos
-- pesos pra ordenar em runtime); só superadmin ESCREVE. CHECK `priorizacao_gutd_soma_100` é a
-- defesa em profundidade caso a validação client-side (`validarPesosGutd`) seja contornada.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-comum-s82@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin-s82@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 1) usuário comum LÊ os pesos (semeados 25/25/25/25 pela migration 0127)
select is(
  (select peso_gravidade from config.priorizacao_gutd where id = 1),
  25,
  'usuario comum le os pesos GUTD (semeados 25/25/25/25)'
);

-- 2) usuário comum tenta escrever — RLS filtra a linha (USING falso), 0 linhas afetadas, sem erro
update config.priorizacao_gutd set peso_gravidade = 90 where id = 1;
select is(
  (select peso_gravidade from config.priorizacao_gutd where id = 1),
  25,
  'usuario comum NAO altera os pesos (RLS escrita_superadmin bloqueia — update silenciosamente 0 linhas)'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000702","user_role":"superadmin"}';

-- 3) superadmin escreve pesos válidos (soma 100)
update config.priorizacao_gutd
  set peso_gravidade = 40, peso_urgencia = 30, peso_tendencia = 20, peso_dor_cliente = 10
  where id = 1;
select is(
  (select peso_gravidade from config.priorizacao_gutd where id = 1),
  40,
  'superadmin altera os pesos GUTD com sucesso (soma 100)'
);

-- 4) CHECK de banco rejeita soma != 100, mesmo vindo do superadmin (defesa em profundidade)
select throws_ok(
  $$ update config.priorizacao_gutd set peso_gravidade = 99 where id = 1 $$,
  '23514',
  null,
  'CHECK priorizacao_gutd_soma_100 rejeita update que nao soma 100'
);

-- 5) pesos continuam os do passo 3 (o update inválido não deixou rastro)
select is(
  (select peso_gravidade from config.priorizacao_gutd where id = 1),
  40,
  'update invalido nao alterou o estado (rollback implicito do CHECK)'
);

-- 6) singleton: nenhuma segunda linha é aceita (CHECK priorizacao_gutd_singleton, id sempre 1)
select throws_ok(
  $$ insert into config.priorizacao_gutd (id, peso_gravidade, peso_urgencia, peso_tendencia, peso_dor_cliente) values (2, 25, 25, 25, 25) $$,
  '23514',
  null,
  'CHECK priorizacao_gutd_singleton rejeita segunda linha (id != 1)'
);

reset role;
select * from finish();
rollback;
