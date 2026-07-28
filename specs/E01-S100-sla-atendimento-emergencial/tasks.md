---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Categoria "Atendimento Emergencial" com SLA de 2h

> Antes da task 1: decidir com `@architect` se emergencial é `tipo_os` novo ou flag de criticidade
> ortogonal (recomendação da spec: flag ortogonal). Vira migration + possível ADR.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                                    | Status |
|----|---------------------------------------------------------------------|----------|------------|---------------------------------------------------|--------|
| 1  | Migration: criticidade/flag emergencial em chamado (e OS)           | AC-1     | —          | pgTAP / `db-tests` verde                          | todo   |
| 2  | Domínio: `calcularPrazoSlaEmergencial(abertura)` = abertura + 2h    | AC-2     | —          | `pnpm test` (unit; borda de replanejamento)       | todo   |
| 3  | Integrar no `calcularPrazoSlaOs`/Hub sem afetar tipos existentes    | AC-2,AC-4 | 2         | `pnpm test` (unit — não-emergencial inalterado)   | todo   |
| 4  | UI: marcar emergencial + badge + contagem de prazo                  | AC-1,AC-2 | 1,2        | Playwright (badge e contagem visíveis)            | todo   |
| 5  | UI: precedência de exibição/ordenação de emergenciais na fila       | AC-3     | 4          | Playwright (emergencial acima)                    | todo   |
| 6  | Garantir que não-emergencial não dispara "violação de SLA cliente"  | AC-4     | 3          | `pnpm test` (unit)                                | todo   |

## Plano de teste
- Unidade: cálculo de prazo (abertura+2h), invariância no replanejamento, tipos não-emergenciais.
- Integração: persistência da flag; interação com Hub de OS.
- Aceite: um teste por AC; Playwright para AC-1/AC-2/AC-3 (UI).

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Decisão emergencial=flag vs tipo registrada (ADR se schema estrutural)
- [ ] `db-tests` (RLS/pgTAP) não pulado
- [ ] `docs/STATE.md` atualizado
