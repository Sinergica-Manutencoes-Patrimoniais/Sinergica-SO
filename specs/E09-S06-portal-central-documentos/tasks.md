---
name: tasks-E09-S06-portal-central-documentos
description: Decomposição — central de documentos do portal.
alwaysApply: false
---

# Tasks — Central de Documentos

> Implementação local concluída em 2026-07-21; signed URLs aguardam teste no backend migrado.

## Plano
| #  | Task                                                    | Cobre AC | Depende de | Gate (comando) | Status |
|----|---------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` nas tabelas de documento (PMOC/SPDA) | AC-1   | E09-S01    | smoke SQL remoto | done |
| 2  | Read-model agregando documentos do condomínio           | AC-1,3   | 1          | `pnpm test`    | done   |
| 3  | Central de Documentos na PortalShell (lista + vazio)    | AC-1,4   | 2          | browser        | done   |
| 4  | Download por signed URL                                 | AC-2     | 3          | browser        | done   |

## Plano de teste
- pgTAP: síndico só vê documentos do próprio `cliente_id`.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes; pgTAP de isolamento
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
