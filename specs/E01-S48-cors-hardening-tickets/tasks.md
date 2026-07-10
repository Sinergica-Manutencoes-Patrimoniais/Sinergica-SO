---
name: tasks
description: Decomposição e gates — diagnóstico/hardening de CORS em Tickets.
alwaysApply: false
---

# Tasks — Diagnóstico/hardening de CORS em Tickets

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `scripts/smoke-edge-functions.mjs`: `probeCors` contra `pcm-auvo-tickets-referencia` com `Origin` de produção | AC-1 | — | leitura + roda no CD | done |
| 2  | `_shared/cors.ts`: `console.warn` em Origin fora da allowlist | AC-2 | — | leitura (sem Deno CLI local) | done |
| 3  | `TicketsPage.tsx`: `mensagemErroCarregarTickets` distingue erro genérico de rede/CORS | AC-3 | — | manual | done |
| 4  | `pnpm run ci:local` + ROADMAP/STATE + **pedir ao Lucas pra conferir `CORS_ALLOWED_ORIGINS` no dashboard Supabase** | todos | 1-3 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- CI: próximo deploy exercita o `probeCors` de verdade (não roda localmente — depende do domínio real).
- Manual: sem forma de reproduzir a falha localmente (é de produção); mensagem nova só visível se o erro
  genérico ocorrer.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma — a causa raiz (valor do secret) não é codificável, só o diagnóstico/hardening.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] Lucas avisado pra conferir o secret
- [ ] ROADMAP/STATE atualizados
