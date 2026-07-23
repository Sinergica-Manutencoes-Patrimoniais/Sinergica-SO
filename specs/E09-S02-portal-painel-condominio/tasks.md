---
name: tasks-E09-S02-portal-painel-condominio
description: Decomposição — painel do condomínio (home do portal).
alwaysApply: false
---

# Tasks — Painel do condomínio

> Implementação local concluída em 2026-07-21; gates de browser aguardam backend migrado.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando) | Status |
|----|-------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | Read-model do painel escopado por `cliente_id` (via fronteira) | AC-1,2 | E09-S01    | `pnpm test`    | done   |
| 2  | Página inicial da PortalShell com cards (SLA/visitas/chamados/docs) | AC-2,4 | 1 | browser        | todo   |
| 3  | Garantir read-only + ausência de dado interno              | AC-2,3   | 2          | revisão + test | done   |
| 4  | Estados vazios por card                                     | AC-4     | 2          | browser        | todo   |

## Plano de teste
- Unidade: montagem do painel a partir do read-model; ausência de campos internos.
- Aceite: um teste por AC; Playwright confirma escopo ao próprio condomínio.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
