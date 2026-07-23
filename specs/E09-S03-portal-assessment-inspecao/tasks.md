---
name: tasks-E09-S03-portal-assessment-inspecao
description: Decomposição — assessment/inspeção no portal (consulta).
alwaysApply: false
---

# Tasks — Assessment no portal

> Implementação concluída; pgTAP de isolamento, build e gates de browser verdes em 2026-07-22.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando) | Status |
|----|-------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` nas tabelas de assessment (E01-S90)     | AC-1     | E09-S01,E01-S90 | smoke SQL remoto | done |
| 2  | Read-model de assessment para o portal (só campos do cliente) | AC-1,2 | 1          | `pnpm test`    | done   |
| 3  | Seção Assessment na PortalShell (lista + detalhe read-only) | AC-1,2,4 | 2          | browser        | done   |
| 4  | Fotos por signed URL                                        | AC-3     | 3          | browser        | done   |

## Plano de teste
- pgTAP: síndico só lê assessment do próprio `cliente_id`.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes; pgTAP de isolamento
- [x] `pnpm run ci:local` verde
- [x] Depende de E01-S90 mergeada
- [x] `docs/STATE.md` + ROADMAP atualizados
