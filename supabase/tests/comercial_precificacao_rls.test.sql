-- comercial_precificacao_rls.test.sql — pgTAP (E03-S03, AC-1)
-- RLS de comercial.parametros_preco/niveis_tecnico/materiais gateada por user_modulos.comercial,
-- singleton de parametros_preco, e as duas RPCs do Financeiro publicadas para o Comercial
-- (fn_custo_hora_medio_por_cargo, fn_aliquota_efetiva_atual — ADR-0019 R2).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prc-sem-modulo-s03@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prc-leitura-s03@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prc-escrita-s03@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;

-- 1) sem `comercial` em user_modulos: RLS FORCE nega, sem erro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from comercial.parametros_preco),
  0,
  'sem modulo comercial: select de parametros_preco retorna zero linhas'
);
select is(
  (select count(*)::int from comercial.niveis_tecnico),
  0,
  'sem modulo comercial: select de niveis_tecnico retorna zero linhas'
);

-- 2) leitura: enxerga o singleton semeado (migration 0180), mas não escreve
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select is(
  (select count(*)::int from comercial.parametros_preco),
  1,
  'leitura comercial: select enxerga a linha singleton semeada'
);
select throws_ok(
  $$ insert into comercial.niveis_tecnico (nome, custo_mensal_referencia_centavos)
     values ('Negado', 100000) $$,
  '42501',
  null,
  'leitura comercial NAO insere nivel_tecnico'
);
-- UPDATE sob RLS não lança erro quando a policy USING filtra a linha (diferente de INSERT, cujo
-- WITH CHECK lança 42501) — vira "0 linhas afetadas" silencioso. Confirma pelo valor inalterado.
update comercial.parametros_preco set margem_alvo_pct = 99 where id = 1;
select is(
  (select margem_alvo_pct from comercial.parametros_preco where id = 1),
  20::numeric,
  'leitura comercial NAO atualiza parametros_preco (valor segue o default do seed)'
);

-- 3) escrita: cria nível e material
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000503","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
insert into comercial.niveis_tecnico (id, nome, custo_mensal_referencia_centavos)
values ('00000000-0000-0000-0000-0000000005a1', 'Nível de teste', 440000);
select is(
  (select count(*)::int from comercial.niveis_tecnico where id = '00000000-0000-0000-0000-0000000005a1'),
  1,
  'escrita comercial: cria nivel_tecnico'
);

insert into comercial.materiais (id, nome, unidade, custo_referencia_centavos)
values ('00000000-0000-0000-0000-0000000005b1', 'Material de teste', 'un', 10000);
select is(
  (select count(*)::int from comercial.materiais where id = '00000000-0000-0000-0000-0000000005b1'),
  1,
  'escrita comercial: cria material'
);

-- 4) AC-1 (singleton): segunda linha em parametros_preco é recusada pelo próprio banco
select throws_ok(
  $$ insert into comercial.parametros_preco (id) values (2) $$,
  '23514',
  null,
  'parametros_preco recusa segunda linha (singleton, check id=1)'
);

update comercial.parametros_preco set margem_alvo_pct = 25 where id = 1;
select is(
  (select margem_alvo_pct from comercial.parametros_preco where id = 1),
  25::numeric,
  'escrita comercial: atualiza a linha singleton existente'
);

-- 5) RPCs publicadas pelo Financeiro para o Comercial (R2) — negam sem permissão de nenhum dos dois módulos
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  $$ select financeiro.fn_aliquota_efetiva_atual() $$,
  '42501',
  null,
  'fn_aliquota_efetiva_atual nega sem modulo comercial nem financeiro'
);
select throws_ok(
  $$ select financeiro.fn_custo_hora_medio_por_cargo('Qualquer Cargo') $$,
  '42501',
  null,
  'fn_custo_hora_medio_por_cargo nega sem modulo comercial nem financeiro'
);

select * from finish();
rollback;
