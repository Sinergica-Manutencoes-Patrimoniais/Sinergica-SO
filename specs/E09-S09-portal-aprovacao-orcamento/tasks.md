---
name: tasks-E09-S09-portal-aprovacao-orcamento
description: Decomposição — aprovação de orçamento no portal.
alwaysApply: false
---

# Tasks — Aprovação de orçamento

> Implementação concluída, incluindo o recorte mínimo da dependência E01-S14 na migration `0144`.
> pgTAP de isolamento/imutabilidade, build e gates de browser verdes em 2026-07-22.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando) | Status |
|----|-------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` na entidade de orçamento (E01-S14)      | AC-1,4   | E09-S01,E01-S14 | smoke SQL remoto | done |
| 2  | Registro de aceite/recusa append-only (autor/timestamp/motivo) | AC-2,3,4 | 1        | tests + smoke SQL | done |
| 3  | Seção Orçamentos na PortalShell (lista + detalhe)           | AC-1     | 1          | browser        | done   |
| 4  | Aprovar → dispara continuação do Fluxo B (E01-S14)          | AC-2     | 2          | `pnpm test`+browser | done |
| 5  | Recusar com motivo (status `recusado`)                     | AC-3     | 2          | browser        | done   |

## Plano de teste
- pgTAP: isolamento + imutabilidade do aceite.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Resolvido: migration `0144` modela o recorte de orçamento necessário e destrava o aceite.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes; pgTAP de isolamento/imutabilidade
- [x] `pnpm run ci:local` verde
- [x] E01-S14 destravada em conjunto
- [x] `docs/STATE.md` + ROADMAP atualizados
