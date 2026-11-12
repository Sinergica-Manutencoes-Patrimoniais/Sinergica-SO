-- E01-S168 (migration 1844, SSO-003) — o despacho T−24 passou a ter acionador.
--
-- A divergência apontada no confronto do Caderno não era de regra: `avaliarEnvioT24`, o ledger
-- de tentativas e as RPCs de concessão/fence já existiam e estavam testados. O que não existia
-- era QUEM chamasse — nenhuma Edge Function implantável importava `orquestracao-t24.ts`, e
-- nenhum cron apontava para lugar nenhum. A promessa do §11.1 dependia de clique na UI.
--
-- Este teste prova as duas metades do acionamento: o job existe com a periodicidade certa, e a
-- função que ele chama é a que aponta para a Edge Function nova. O comportamento de falhar
-- fechado (sem contrato comprovado do Auvo, nada sai) é provado do lado TypeScript, em
-- `supabase/functions/_shared/auvo/composicao-http-t24.test.ts`.
begin;
select plan(5);

select is(
  (select schedule from cron.job where jobname = 'pcm_t24_despachar_15min'),
  '*/15 * * * *',
  'o despacho T-24 roda a cada 15 min: a janela do §11.1 é de 24h, granularidade fina só multiplicaria chamada ao Auvo'
);
select is(
  (select command from cron.job where jobname = 'pcm_t24_despachar_15min'),
  'select pcm.fn_invoke_t24_despachar();',
  'o job chama a função de despacho, não um SQL solto'
);
select has_function('pcm', 'fn_invoke_t24_despachar', 'a função de acionamento existe');
select is(
  (select p.prosecdef from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'pcm' and p.proname = 'fn_invoke_t24_despachar'),
  true,
  'security definer: o cron roda sem papel de aplicação e precisa ler o Vault'
);

-- Ninguém da aplicação aciona o despacho direto. Quem dispara é o cron (ou um operador com
-- acesso ao banco); a borda autenticada é a Edge Function, não esta função.
select is(
  (select count(*)::int from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'pcm' and p.proname = 'fn_invoke_t24_despachar'
       and (has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('anon', p.oid, 'execute'))),
  0,
  'nem authenticated nem anon podem acionar o despacho T-24 direto'
);

select * from finish();
rollback;
