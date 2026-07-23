---
name: tasks-E09-S09-portal-aprovacao-orcamento
description: Decomposição — aprovação de orçamento no portal.
alwaysApply: false
---

# Tasks — Aprovação de orçamento

> Implementação local concluída em 2026-07-21, incluindo recorte mínimo da dependência E01-S14;
> pgTAP/browser ainda não executados neste ambiente.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando) | Status |
|----|-------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` na entidade de orçamento (E01-S14)      | AC-1,4   | E09-S01,E01-S14 | smoke SQL remoto | done |
| 2  | Registro de aceite/recusa append-only (autor/timestamp/motivo) | AC-2,3,4 | 1        | tests + smoke SQL | done |
| 3  | Seção Orçamentos na PortalShell (lista + detalhe)           | AC-1     | 1          | browser        | todo   |
| 4  | Aprovar → dispara continuação do Fluxo B (E01-S14)          | AC-2     | 2          | `pnpm test`+browser | todo |
| 5  | Recusar com motivo (status `recusado`)                     | AC-3     | 2          | browser        | todo   |

## Plano de teste
- pgTAP: isolamento + imutabilidade do aceite.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Bloqueada até E01-S14 modelar a entidade de orçamento — coordenar destrave conjunto.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes; pgTAP de isolamento/imutabilidade
- [ ] `pnpm run ci:local` verde
- [ ] E01-S14 destravada em conjunto
- [ ] `docs/STATE.md` + ROADMAP atualizados
