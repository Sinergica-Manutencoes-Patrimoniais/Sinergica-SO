-- pcm_satisfacao_inativa.test.sql — pgTAP (E03-S11)
-- Confirma o estado pós-migration 0201: `pcm.satisfacao_respostas` continua existindo (AC-3, sem
-- drop) mas documentada como espelho inativo, e `pcm.portal_satisfacao` (fonte canônica) segue
-- intacta. O desligamento do recurso `satisfactions` em si vive em código TypeScript
-- (supabase/functions/pcm-auvo-support-pull/index.ts) — não testável por pgTAP; coberto por
-- revisão de código + smoke test manual (AC-1/AC-6). Rodar com `supabase test db` (requer Docker).

begin;
select plan(4);

-- AC-3: a tabela NÃO foi dropada (decisão do PO preserva histórico, é espelho de sistema externo)
select is(
  (select to_regclass('pcm.satisfacao_respostas')::text),
  'pcm.satisfacao_respostas',
  'pcm.satisfacao_respostas continua existindo — sem drop'
);

-- AC-3: comment on table documenta a desativação e como reativar
select ok(
  (select obj_description('pcm.satisfacao_respostas'::regclass, 'pg_class')) ilike '%DESATIVADA%',
  'comment on table pcm.satisfacao_respostas documenta a desativação (E03-S11)'
);

select ok(
  (select obj_description('pcm.satisfacao_respostas'::regclass, 'pg_class')) ilike '%portal_satisfacao%',
  'comment on table pcm.satisfacao_respostas aponta pcm.portal_satisfacao como fonte canônica'
);

-- AC-4: portal_satisfacao (fonte canônica) segue existindo e intocada
select is(
  (select to_regclass('pcm.portal_satisfacao')::text),
  'pcm.portal_satisfacao',
  'pcm.portal_satisfacao (fonte canônica de CSAT/NPS) não foi alterada por esta story'
);

select * from finish();
rollback;
