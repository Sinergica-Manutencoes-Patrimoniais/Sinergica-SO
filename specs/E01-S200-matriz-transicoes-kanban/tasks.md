---
name: tasks
description: "Decomposição de E01-S200."
alwaysApply: false
---

# Tasks — E01-S200 · Matriz de movimentações do Kanban

| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Inventário dos caminhos que escrevem status (banco e interface) | AC-9 | relatório no `spec.md` | **done** — 6 de banco, 4 manuais |
| 2 | Domínio `transicoes-os.ts` com matriz explícita e motivo por recusa | AC-1→AC-8 | `pnpm vitest run src/features/pcm/domain/transicoes-os.test.ts` | **done** — 16 testes |
| 3 | Ligar no arrastar, com recusa visível | AC-8, AC-F1 | `pnpm vitest run src/features/pcm/components` | **done** |
| 4 | Flag declarada em registro, `.env.example` e `netlify.toml` | AC-F2, AC-F3 | `node scripts/check-flags-declaradas.mjs` | **done** — 741 flags |
| 5 | Seletor montado com `destinosPermitidos` | AC-8 | teste de componente | todo |
| 6 | Painel de detalhe e ação em lote consultam a matriz | AC-8 | teste de componente | todo |
| 7 | Enforcement no banco, após confirmar que nenhum chamador automático passa por `fn_operacao_alterar_status_lote` | AC-9 | pgTAP permitido e negado | todo |

## Rastreabilidade AC→task (completa)

AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-F1, AC-F2, AC-F3, AC-F5.
