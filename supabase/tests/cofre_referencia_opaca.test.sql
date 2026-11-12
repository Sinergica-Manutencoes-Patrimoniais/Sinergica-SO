-- cofre_referencia_opaca.test.sql — pgTAP (E02-S35, AC-3)
-- anon/authenticated negados; formato de referência recusado; ciclo gravar/ler/remover por service_role.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

-- anon/authenticated não executam (sem GRANT)
select throws_ok(
  $$ select config.fn_gravar_segredo_referenciado('SINERGICA_TESTE_1_00000000000000000000000000000000', 'valor') $$,
  '42501',
  null,
  'anon/authenticated sem EXECUTE em fn_gravar_segredo_referenciado'
);

-- service_role: formato inválido é recusado antes de tocar o Vault
set local role service_role;

select throws_ok(
  $$ select config.fn_gravar_segredo_referenciado('nome-livre-qualquer', 'valor') $$,
  '22023',
  null,
  'referência fora do formato SINERGICA_<RECURSO>_<GERACAO>_<ID32HEX> é recusada'
);

select throws_ok(
  $$ select config.fn_gravar_segredo_referenciado('evolution_api_key', 'valor') $$,
  '22023',
  null,
  'função não serve para gravar sob nome livre de outro segredo'
);

-- service_role: ciclo gravar/ler/sobrescrever/remover com referência sintética válida
select lives_ok(
  $$ select config.fn_gravar_segredo_referenciado(
       'SINERGICA_EVOTOKEN_1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'token-inicial') $$,
  'service_role grava segredo sob referência válida'
);

select is(
  (select config.fn_ler_segredo_referenciado('SINERGICA_EVOTOKEN_1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  'token-inicial',
  'leitura devolve o valor gravado'
);

select lives_ok(
  $$ select config.fn_remover_segredo_referenciado('SINERGICA_EVOTOKEN_1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') $$,
  'service_role remove o segredo (rotação/revogação)'
);

select * from finish();
rollback;
