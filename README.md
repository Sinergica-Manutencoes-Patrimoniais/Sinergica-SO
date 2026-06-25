# os-layer — Overlay para sistemas OS (monorepo multi-domínio)

Esta camada é aplicada **por cima** do `base/` quando um projeto passa de **single-repo** para
**OS** (N sistemas/domínios juntos). Não substitui a base — **complementa**: a metodologia SDD,
os artefatos (`specs/`, `docs/`), o `CLAUDE.md`, os gates e o exemplo continuam valendo.

## Quando aplicar
Só quando há **fronteira de domínio real** (bounded contexts distintos que evoluem em ritmos
diferentes, times/responsabilidades separadas, ou necessidade de schemas isolados). Ver
`ANTI-PADROES.md`: **não monte monorepo "por precaução"**.

## Como aplicar (resumo)
1. Copie o conteúdo de `os-layer/` para a raiz do projeto (sobre o `base/` já existente).
2. Mova o código atual de `src/` para `apps/web/src/` (ou o app correspondente).
3. Promova tipos/contratos compartilhados para `packages/shared/`.
4. Rode a migration `supabase/migrations/0001_schemas_dominio.sql` adaptando os schemas aos seus
   bounded contexts.
5. Ajuste `pnpm-workspace.yaml`, `turbo.json` e `.github/CODEOWNERS`.
6. Aplique a segurança **OS-grade** (`seguranca/os-grade.md`) — RLS FORCE, `audit.*` append-only.

## O que vem aqui
```
os-layer/
  package.json            → raiz do monorepo (private, workspaces)
  pnpm-workspace.yaml      → apps/* e packages/*
  turbo.json               → tasks com cache (build, lint, typecheck, test)
  apps/web/                → app principal (feature-based por domínio)
  packages/{config,database,shared,ui}/  → pacotes compartilhados
  supabase/
    migrations/0001_schemas_dominio.sql  → schemas por domínio + RLS FORCE + audit
    (Edge Functions e _shared/ vêm da base: base/supabase/functions/{_shared,_template})
  docs/ARCHITECTURE.md     → documento vivo: bounded contexts + context-map
  .github/CODEOWNERS       → review obrigatório por área
  seguranca/os-grade.md    → baseline OS-grade
```
