---
name: tasks-E09-S05-portal-os-notas-anexos
description: Decomposição — OS no portal com notas/anexos do cliente.
alwaysApply: false
---

# Tasks — OS no portal (notas/anexos)

> Implementação concluída; pgTAP de isolamento/imutabilidade, build e gates de browser verdes em
> 2026-07-22. Notas permanecem PCM-side e não propagam ao Auvo.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | RLS por `cliente_id` na leitura de `pcm.ordens_servico` p/ portal | AC-1 | E09-S01 | smoke SQL remoto             | done   |
| 2  | Migration `pcm.os_notas` (append-only, RLS `cliente_id`) + bucket `os-anexos` | AC-2,3,4 | 1 | lint + smoke SQL remoto | done |
| 3  | Seção OS na PortalShell (lista + detalhe read-only)         | AC-1     | 1          | browser                      | done   |
| 4  | Adicionar nota do cliente (append-only)                    | AC-2,4   | 2          | `pnpm test`+browser          | done   |
| 5  | Anexar arquivo (bucket + signed URL + validação)           | AC-3     | 2          | browser                      | done   |
| 6  | Decidir/registrar: nota propaga ao Auvo? (default: não)    | AC-2     | 4          | doc + test                   | done   |

## Plano de teste
- pgTAP: isolamento de OS e de notas por `cliente_id`; nota append-only (sem update/delete p/ cliente).
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Resolvido: nota do cliente permanece PCM-side e não propaga ao Auvo.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes; pgTAP de isolamento + imutabilidade
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
