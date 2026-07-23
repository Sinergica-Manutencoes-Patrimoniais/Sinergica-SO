---
name: tasks-E09-S07-portal-cronograma-conformidade
description: Decomposição — cronograma + conformidade no portal.
alwaysApply: false
---

# Tasks — Cronograma + conformidade

> Implementação local concluída em 2026-07-21; pgTAP/browser ainda não executados neste ambiente.

## Plano
| #  | Task                                                       | Cobre AC | Depende de | Gate (comando) | Status |
|----|------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` nas tabelas PMOC expostas ao portal    | AC-1,3   | E09-S01    | smoke SQL remoto | done |
| 2  | Domínio: status vigente/vencendo/vencido (reusa E01-S08)   | AC-2     | —          | `pnpm test`    | done   |
| 3  | Seção Cronograma (calendário de preventivas)               | AC-1,4   | 1          | browser        | todo   |
| 4  | Seção Conformidade (ART/PMOC/laudos com status)            | AC-2,4   | 1,2        | browser        | todo   |

## Plano de teste
- Unidade: classificação vigente/vencendo/vencido.
- pgTAP: isolamento por `cliente_id`.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes; pgTAP de isolamento
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
