---
name: tasks-E01-S85-sync-ativos-localizacao-auvo
description: Decomposição — sync localização/sistema PCM↔Auvo.
alwaysApply: false
---

# Tasks — Sync ativos localização + sistema

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)          | Status |
|----|-------------------------------------------------------------------|----------|------------|-------------------------|--------|
| 1  | Domínio: concatenar `Área·Local·Sublocal` (separador/ordem config)| AC-1     | design     | `pnpm test`             | todo   |
| 2  | Descriptor/entity registry para localização + sistema             | AC-1,4   | 1          | teste Deno              | todo   |
| 3  | Trigger de re-enfileiramento em rename de Área/Local/Sublocal      | AC-2     | 2          | `pnpm lint:migrations`+pgTAP | todo |
| 4  | Mover ativo (Board) enfileira update de localização               | AC-3     | 2          | Playwright              | todo   |
| 5  | Sistema → equipamento agregado no Auvo; componentes não sobem     | AC-4     | 2          | teste Deno              | todo   |
| 6  | Manter `writeEnabled=false` até verificação de campo (E01-S36)    | AC-5     | 2          | revisão + doc           | todo   |
| 7  | ADR atualizando ADR-0006 (sistema agregado)                       | AC-4     | 5          | doc                     | todo   |

## Plano de teste
- Unidade: concatenação (casos com sublocal ausente, separador custom).
- Integração: descriptor monta payload Auvo correto; trigger enfileira em lote no rename.
- Aceite: um teste por AC (localização, rename propaga, move propaga, sistema agregado, gate).

## Divergências (SPEC_DEVIATION)
- [ ] `writeEnabled` real depende de acesso à API Auvo para verificação de campo — herda bloqueio de
  E01-S36; registrar se ficar dry-run.

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes (AC-5 pode ficar dry-run documentado)
- [ ] `pnpm run ci:local` verde; pgTAP/Deno confirmados no CI
- [ ] ADR-0006 atualizado
- [ ] `docs/STATE.md` + ROADMAP atualizados
