---
name: tasks
description: Decomposição e gates — reserva de ferramenta por período.
alwaysApply: false
---

# Tasks — E01-S64 · Reserva por período

> Depende de E01-S63 mergeada. Marcar owner no ROADMAP. Branch: `feat/E01-S64-ferramentas-reserva`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E01-S64_ferramenta_reservas.sql`: `pcm.ferramenta_reservas` (unidade opcional, funcionario, período, status `pendente/efetivada/cancelada`), exclusion constraint ou check via trigger para não sobrepor no mesmo `unidade_id` — RLS FORCE padrão | AC-1, AC-2 | S63 | `pnpm run lint:migrations` | todo |
| 2 | `domain/ferramenta-reservas.ts`: detecção de sobreposição de intervalo, escolha de unidade livre pra reserva genérica — puro, testes (borda: intervalos que só tocam na borda) | AC-1, AC-2 | 1 | `pnpm run test` | todo |
| 3 | Use cases + adapter: criar/cancelar/efetivar reserva, listar agenda | AC-1, AC-3–AC-5 | 2 | `pnpm run test` | todo |
| 4 | UI: seção de reservas em `FerramentasPage` (criar, agenda por data, efetivar/cancelar) | AC-1, AC-3–AC-5 | 3 | `pnpm run test` | todo |
| 5 | pgTAP: constraint de não-sobreposição realmente rejeita conflito | AC-2 | 1 | CI `db-tests` | todo |
| 6 | `pnpm run ci:local` + Playwright (reservar→efetivar, reservar→cancelar, conflito rejeitado) + ROADMAP/STATE | todos | 1–5 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: sobreposição (mesmo dia, borda início=fim de outra, sem sobreposição).
- pgTAP: 2 reservas conflitantes → erro.
- Playwright: fluxo completo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (reserva genérica quando
  não há nenhuma unidade livre em nenhum cenário) · ROADMAP/STATE atualizados
