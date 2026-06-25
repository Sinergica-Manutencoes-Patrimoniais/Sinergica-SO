---
name: tasks
description: Decomposição e gates do cálculo de comissão (exemplo de referência).
alwaysApply: false
---

# Tasks — Cálculo de comissão

> Cada task mapeia para `AC-N` e tem gate executável. Um commit por task.
> Gate desta feature: `npx vitest run src/domain/comissao` (ver `Definition-of-Done.md`).

## Plano
| #  | Task                                                       | Cobre AC           | Depende de | Gate (comando)                                  | Status |
|----|------------------------------------------------------------|--------------------|------------|-------------------------------------------------|--------|
| 1  | Value object `Dinheiro` (centavos, não-negativo, inteiro)  | AC-4               | —          | `npx vitest run src/domain/comissao/dinheiro`   | done   |
| 2  | `FaixaComissao` + `TabelaComissao.faixaPara(valor)`        | AC-2, AC-3         | 1          | `npx vitest run src/domain/comissao/tabela`     | done   |
| 3  | `calcularComissao(valor, tabela)` (domínio)                | AC-1, AC-2, AC-3   | 1,2        | `npx vitest run src/domain/comissao/tabela`     | done   |
| 4  | Caso de uso `calcularComissaoVenda` (application) `[P]`     | AC-1, AC-4         | 3          | `npx vitest run src/application/calcular-comissao` | done |

## Plano de teste
- Unidade: invariantes de `Dinheiro` (negativo/fração rejeitados); `faixaPara` nos limites.
- Aceite: um teste por linha da matriz de decisão da `spec.md` (é o gate de aceite).

## Divergências (SPEC_DEVIATION)
- [ ] nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] ADR registrado (ADR-0001 — Dinheiro em centavos)
- [x] Glossário/domínio refletem o código
- [x] Spec marcada como implementada
- [x] `docs/STATE.md` atualizado
