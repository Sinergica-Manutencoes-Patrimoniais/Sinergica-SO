-- E01 (varredura transversal) — invariante estrutural que sustenta a migration 1839.
--
-- 1839 concedeu `execute` a `authenticated` em 272 RPCs chamadas pela UI. A justificativa de
-- segurança foi: todas checam um `_gate` ANTES de qualquer escrita, logo o grant é inerte
-- enquanto os gates seguirem fechados. Isso foi verificado uma vez, no momento da migration —
-- mas é propriedade que regride em silêncio: basta um `create or replace` mover a checagem de
-- gate para depois de um insert/update.
--
-- Aqui a verificação é reconstruída a cada execução, direto de `pg_get_functiondef`.
--
-- Escopo: funções `sso_*` públicas (executáveis por `authenticated`) que escrevem E são
-- governadas por gate. A violação é checar o gate DEPOIS de já ter escrito.
--
-- Fora de escopo de propósito: funções públicas que escrevem sem gate nenhum. Elas existem e são
-- legítimas — RBAC de base e comandos anteriores ao modelo de gates (ex.: sso_definir_concessao,
-- sso_criar_grupo_atomico, sso_aprovar_plano), que se protegem por papel/autorização própria, não
-- por rollout. Gate é mecanismo de ativação de feature, não de autorização; exigir gate delas
-- seria confundir as duas coisas.
begin;
select plan(3);

create temporary table publicas_que_escrevem on commit drop as
select n.nspname || '.' || p.proname as nome,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as assinatura,
       lower(pg_get_functiondef(p.oid)) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where l.lanname = 'plpgsql'
  and n.nspname in ('pcm', 'comercial', 'financeiro', 'config')
  and p.proname like 'sso\_%'
  and has_function_privilege('authenticated', p.oid, 'execute');

create temporary table violacoes on commit drop as
select nome, assinatura
from (
  select nome, assinatura,
    position('_gate' in def) as pos_gate,
    least(
      coalesce(nullif(position('insert into' in def), 0), 2147483647),
      coalesce(nullif(position('update ' in def), 0), 2147483647),
      coalesce(nullif(position('delete from' in def), 0), 2147483647)
    ) as pos_escrita
  from publicas_que_escrevem
) z
where pos_escrita < 2147483647   -- escreve
  and pos_gate > 0               -- e é governada por gate
  and pos_gate > pos_escrita;    -- mas só checa o gate depois de já ter escrito

select ok(
  (select count(*) from publicas_que_escrevem) > 250,
  'o conjunto público de RPCs sso_ é grande o bastante para a invariante ser significativa'
);

select is(
  (select count(*)::int from violacoes),
  0,
  'nenhuma RPC pública governada por gate escreve antes de checá-lo (invariante que torna a 1839 inerte)'
);

-- Nomeia as culpadas no output do CI quando a asserção acima falhar.
select is(
  (select coalesce(string_agg(assinatura, ' | ' order by assinatura), '(nenhuma)') from violacoes),
  '(nenhuma)',
  'lista de RPCs públicas que escreveriam antes do gate'
);

select * from finish();
rollback;
