---
name: tasks-E04-S07-robustez-lancamentos
description: Decomposição — robustez operacional dos lançamentos.
alwaysApply: false
---

# Tasks — Robustez operacional dos lançamentos

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: bucket `financeiro-comprovantes` + anexo no lançamento | AC-1 | E04-S01    | `pnpm lint:migrations`+pgTAP | todo   |
| 2  | Migration: eventos append-only de estorno/correção + par de transferência | AC-2,3,4 | E04-S01 | pgTAP           | todo   |
| 3  | Domínio: estorno/correção (recalcula saldo) + regra conciliado | AC-2,4  | —          | `pnpm test`                  | todo   |
| 4  | Domínio: transferência (não afeta resultado)               | AC-3     | —          | `pnpm test`                  | todo   |
| 5  | UI: anexar comprovante (upload + signed URL)               | AC-1     | 1          | browser                      | todo   |
| 6  | UI: estornar/corrigir + estornar baixa + transferência     | AC-2,3,4 | 2,3,4      | browser                      | todo   |

## Plano de teste
- Unidade: recálculo de saldo pós-estorno; transferência neutra no resultado; bloqueio de conciliado.
- pgTAP: eventos append-only, RLS do bucket/tabelas.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde; migration aditiva
- [ ] `docs/STATE.md` + ROADMAP atualizados
