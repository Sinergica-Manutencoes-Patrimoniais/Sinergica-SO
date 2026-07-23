---
name: tasks-E09-S04-portal-chamados
description: Decomposição — chamados no portal.
alwaysApply: false
---

# Tasks — Chamados no portal

> Implementação local concluída em 2026-07-21; pgTAP/browser ainda não executados neste ambiente.

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando) | Status |
|----|---------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | RLS por `cliente_id` em `pcm.chamados` + eventos (E01-S88)     | AC-1,2   | E09-S01,E01-S88 | smoke SQL remoto | done |
| 2  | Abrir Chamado pelo portal (`origem='cliente_portal'`)         | AC-1     | 1          | `pnpm test`+browser | todo  |
| 3  | Lista + detalhe dos próprios Chamados (status/eventos)        | AC-2,4   | 1          | browser        | todo   |
| 4  | Comentário/anexo do cliente (append-only)                    | AC-3     | 1          | `pnpm test`+browser | todo  |
| 5  | Validação de anexo + gate de ações internas escondidas       | AC-3,4   | 2,3,4      | browser        | todo   |

## Plano de teste
- pgTAP: síndico só lê/abre chamado do próprio `cliente_id`; não enxerga de outro.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes; pgTAP de isolamento
- [ ] `pnpm run ci:local` verde
- [ ] Depende de E01-S88 mergeada
- [ ] `docs/STATE.md` + ROADMAP atualizados
