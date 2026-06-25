---
name: db
description: Padrões de banco para single-repo (migrations, naming, RLS). Puxe ao mexer em schema/tabela/migration.
alwaysApply: false
---

# Banco de dados — perfil single-repo

> Vale para projetos **single-repo** (schema `public`). Sistemas **OS** somam schemas por
> domínio e governança — ver `os-layer/seguranca/os-grade.md` e `os-layer/docs/ARCHITECTURE.md`.
> Toda tabela nasce com **RLS** (baseline mínimo). Referência: `db/rls.template.sql`,
> exemplo real: `db/migrations/0001_comissoes.sql`.

## Migrations
- **Naming obrigatório:** `NNNN_E0N-S0N_descricao.sql`
  - `NNNN` = sequência numérica crescente (garante ordem de execução no Supabase)
  - `E0N-S0N` = ID do épico + story que gerou esta migration (ex.: `E01-S02`)
  - Exemplos: `0001_E00-S00_schemas_dominio.sql` · `0002_E01-S02_tabela_ordens.sql`
- **Uma migration por story** — se a story cria várias tabelas, tudo em um único arquivo.
  Se duas stories tocam o mesmo schema em paralelo, coordenar via ROADMAP (sem merge conflict).
- **Idempotência de DDL:** use `create table if not exists`, `add column if not exists`,
  `create index if not exists` — a migration pode reaplicar sem quebrar.
- **Reverso documentado no topo:** toda migration começa com um comentário com o SQL de rollback
  (ex.: `-- Reverso: DROP TABLE IF EXISTS ...`). Migration destrutiva sem reverso é anti-padrão.
- **Antes de produção:** backup manual (Supabase → Database → Backups), depois revisar com
  `supabase db diff` e aplicar com `supabase db push`. Ver `runbooks/rollback-deploy.md`.
- Nunca edite uma migration já aplicada em produção — crie uma nova que corrija.

## Naming
- Tabelas e colunas em `snake_case`, tabela no plural (`comissoes`), PK `id uuid default gen_random_uuid()`.
- Chave de negócio explícita e `unique` quando há idempotência (ex.: `venda_id text unique`).
- Auditoria mínima: `criado_em timestamptz default now()`. Em dado mutável, `atualizado_em`.
- `check` para invariantes simples no banco (ex.: `comissao_centavos >= 0`) — defesa em profundidade.
- Dinheiro em **centavos inteiros** (`integer`), nunca `float`/`numeric` para evitar arredondamento (ADR-0001).

## Schema vs tabela única (não over-engineer)
- Single-repo fica em `public`. **Não crie schema por domínio "por precaução"** — isso é do perfil OS.
- Promova para schemas por domínio só ao virar OS (ver `03 - Perfis de Projeto` / guia de promoção).

## RLS (obrigatório)
- `alter table ... enable row level security;` em **toda** tabela. Sem policy = sem acesso.
- Policies por papel lido do JWT (`auth.jwt() ->> 'user_role'`). Template em `db/rls.template.sql`.
- Escrita sensível normalmente via Edge Function com `service_role` (bypassa RLS) — ver
  `supabase/functions/_template/index.ts`. `service_role` **nunca** no client.
- Como testar que a RLS realmente protege: `db/rls-test.md`.

## Mapeamento domínio ↔ banco
O domínio não conhece o banco. O **adapter** (em `src/infrastructure/`) mapeia a linha para a
entidade e vice-versa — ex.: `repositorio-supabase.ts` converte `comissao_centavos` ↔ `Dinheiro`.
