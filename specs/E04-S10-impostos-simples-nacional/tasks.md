---
name: tasks-E04-S10-impostos-simples-nacional
description: Decomposição — provisão de impostos (Simples Nacional/DAS).
alwaysApply: false
---

# Tasks — Impostos / Simples Nacional

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: config de impostos (regime/alíquota/faixas)      | AC-1     | E04-S01    | `pnpm lint:migrations`+pgTAP | done   |
| 2  | Domínio: alíquota efetiva por RBT12 + provisão (função pura) | AC-2,3   | —          | `pnpm test`                  | done   |
| 3  | Geração de pagável de imposto por competência (idempotente) | AC-2     | 1,2        | `pnpm test`+pgTAP            | done   |
| 4  | Reflexo na projeção de caixa/resultado                     | AC-4     | 3          | `pnpm test`                  | done   |
| 5  | UI Config → Impostos + visão da provisão                   | AC-1     | 1          | browser                      | done   |

## Plano de teste
- Unidade: alíquota efetiva (faixas RBT12), provisão idempotente por competência, receita zero.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Resolvido: V1 suporta configuração por alíquota fixa e por faixas RBT12.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
