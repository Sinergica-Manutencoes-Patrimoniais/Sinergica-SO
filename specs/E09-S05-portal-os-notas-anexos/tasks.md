---
name: tasks-E09-S05-portal-os-notas-anexos
description: Decomposição — OS no portal com notas/anexos do cliente.
alwaysApply: false
---

# Tasks — OS no portal (notas/anexos)

> Implementação local concluída em 2026-07-21; pgTAP/browser ainda não executados neste ambiente.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | RLS por `cliente_id` na leitura de `pcm.ordens_servico` p/ portal | AC-1 | E09-S01 | smoke SQL remoto             | done   |
| 2  | Migration `pcm.os_notas` (append-only, RLS `cliente_id`) + bucket `os-anexos` | AC-2,3,4 | 1 | lint + smoke SQL remoto | done |
| 3  | Seção OS na PortalShell (lista + detalhe read-only)         | AC-1     | 1          | browser                      | todo   |
| 4  | Adicionar nota do cliente (append-only)                    | AC-2,4   | 2          | `pnpm test`+browser          | todo   |
| 5  | Anexar arquivo (bucket + signed URL + validação)           | AC-3     | 2          | browser                      | todo   |
| 6  | Decidir/registrar: nota propaga ao Auvo? (default: não)    | AC-2     | 4          | doc + test                   | done   |

## Plano de teste
- pgTAP: isolamento de OS e de notas por `cliente_id`; nota append-only (sem update/delete p/ cliente).
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Propagação da nota do cliente ao Auvo — decidir e registrar (default PCM-side).

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes; pgTAP de isolamento + imutabilidade
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
