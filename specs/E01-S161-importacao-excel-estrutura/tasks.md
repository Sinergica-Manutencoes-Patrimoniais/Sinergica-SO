---
name: tasks-E01-S161
description: Tasks da E01-S161 — lib/sheetjs compartilhado, domínio de parse/plano/exportação, execução sequencial via casos de uso, modal de importação na Estrutura.
alwaysApply: false
---

# Tasks — E01-S161 Importação/exportação da estrutura via Excel

> Commits: `feat(E01-S161): ...`. Paths relativos a `apps/web/src/`.
> O domínio é **puro**: recebe matrizes (`unknown[][]`) e o estado atual, e devolve plano/planilha.
> SheetJS só aparece em `lib/` e no componente.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **`lib/sheetjs.ts`**: leitor/escritor SheetJS compartilhado e InspecoesPage migrada. | AC-1, AC-6 | — | typecheck | done local |
| 2 | **Domínio: modelo e exportação**. | AC-1 | — | vitest focado | done local |
| 3 | **Domínio: parse**. | AC-3, AC-4 | 2 | vitest focado | done local |
| 4 | **Domínio: plano** (diff, referências, dependências, ordem, erros e avisos). | AC-2, AC-3, AC-4, AC-5 | 3 | vitest focado | done local |
| 5 | **Application**: executor sequencial pelos casos de uso, com relatório de falha/dependência. | AC-5 | 4 | vitest focado | done local |
| 6 | **UI**: simulação, confirmação, progresso, relatório e invalidação de queries. | AC-1, AC-3, AC-5, AC-6 | 1, 5 | ci:local | done local |
| 7 | **Planilha de exemplo**: abas e cabeçalhos conferidos contra o contrato final. | AC-1 | 2 | inspeção xlsx | done local |
| 8 | **E2E**: specs S159–S161 escritas e parseadas pelo Playwright; execução autenticada pendente de `SUPABASE_TEST_EMAIL/PASSWORD`. | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 6 | playwright test | done local / execução externa pendente |

## Plano de teste
- Unidade: exportação, parse, plano (tabela de erros inteira), execução com fakes.
- Aceite: E2E (task 8).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-6 E2E autenticado (credenciais de teste pendentes) · `ci:local`
- [x] Planilha de exemplo conferida
- [x] ROADMAP · STATE
