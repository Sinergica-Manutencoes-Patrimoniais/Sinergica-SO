---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Categoria "Atendimento Emergencial" com SLA de 2h

> Correção (2026-07-28): `C1` já é 100% exclusivo do emergencial — não cria tipo novo, só muda o
> número do SLA em `calcularPrazoSlaOs`.

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)                             | Status |
|----|--------------------------------------------------------------------|----------|------------|---------------------------------------------|--------|
| 1  | `calcularPrazoSlaOs`: C1 de 4h → 2h                                | AC-1     | —          | `pnpm test` (unit atualizado)                | done   |
| 2  | Confirmar badge/ordenação de C1 já destaca (revisão de UI, sem código novo se já existir) | AC-2 | — | Playwright (visual)                          | todo   |
| 3  | Garantir que C2/P1/P2/IN não disparam alerta de SLA contratual    | AC-3     | —          | `pnpm test` (unit — já é o comportamento atual, só confirmar) | done |

## Plano de teste
- Unidade: `calcularPrazoSlaOs("C1", ...)` = 2h (era 4h); C2/P1/P2/IN inalterados.
- Aceite: Playwright confirma badge "Emergencial" e destaque na fila do Hub.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md` atualizado
