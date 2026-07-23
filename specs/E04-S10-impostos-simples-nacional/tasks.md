---
name: tasks-E04-S10-impostos-simples-nacional
description: Decomposição — provisão de impostos (Simples Nacional/DAS).
alwaysApply: false
---

# Tasks — Impostos / Simples Nacional

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: config de impostos (regime/alíquota/faixas)      | AC-1     | E04-S01    | `pnpm lint:migrations`+pgTAP | todo   |
| 2  | Domínio: alíquota efetiva por RBT12 + provisão (função pura) | AC-2,3   | —          | `pnpm test`                  | todo   |
| 3  | Geração de pagável de imposto por competência (idempotente) | AC-2     | 1,2        | `pnpm test`+pgTAP            | todo   |
| 4  | Reflexo na projeção de caixa/resultado                     | AC-4     | 3          | `pnpm test`                  | todo   |
| 5  | UI Config → Impostos + visão da provisão                   | AC-1     | 1          | browser                      | todo   |

## Plano de teste
- Unidade: alíquota efetiva (faixas RBT12), provisão idempotente por competência, receita zero.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Confirmar com o PO: alíquota fixa vs faixas RBT12 no V1.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
