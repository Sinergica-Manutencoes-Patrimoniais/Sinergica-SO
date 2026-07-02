---
name: tasks
description: Decomposição e gates do sync de técnicos/equipamentos Auvo → PCM. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Sync de Técnicos, Equipes e Equipamentos

> Nenhuma task executada ainda — resultado de estudo/planejamento. Depende de `E01-S09`
> (fundação, cliente HTTP compartilhado) implementada primeiro.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Decidir com Fabrício o gatilho do sync (cron `pg_cron` diário vs. botão manual — Casos de borda da spec) | AC-1, AC-2 | `E01-S09` implementada | decisão registrada nesta spec (remove a ambiguidade) | todo |
| 2  | Migration: `pcm.tecnicos_cache` (`auvo_user_id`, nome, equipe, `ativo`) e `pcm.equipamentos_cache` (`auvo_equipment_id`, vínculo com `pcm.clientes`, `ativo`) — RLS FORCE, só `service_role` grava | AC-3 | — | `pnpm run lint:migrations` limpo | todo |
| 3  | Edge Function `pcm-auvo-users-sync`: pagina `GET /users`, upsert por `auvo_user_id`, soft-delete dos ausentes | AC-1, AC-4 | 2 | teste de integração com mock paginado | todo |
| 4  | Edge Function `pcm-auvo-equipment-sync`: pagina `GET /equipments`, upsert por `auvo_equipment_id`, vincula a `pcm.clientes.auvo_id` | AC-2, AC-4 | 2 | teste de integração com mock paginado | todo |
| 5  | Gatilho definido na task 1 (cron ou endpoint manual) `[P]` | AC-1, AC-2 | 1, 3, 4 | inspeção + execução manual bem-sucedida | todo |
| 6  | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S11` implementado, AC verdes | — | 1-5 | inspeção | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção").

## Plano de teste
- Unidade: lógica de soft-delete (item presente no cache, ausente na resposta do Auvo → marca
  `ativo = false`, não deleta).
- Integração: paginação simulada (2+ páginas), upsert idempotente (rodar sync 2x seguidas não
  duplica nem falha).
- RLS: `db/rls-test.md` — pgTAP confirmando que um papel que não seja `service_role` não
  consegue `INSERT`/`UPDATE` nas tabelas de cache (AC-3).

## Divergências (SPEC_DEVIATION)
- Nenhuma — story ainda não implementado.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Glossário atualizado se mudou (`pcm.tecnicos_cache`/`pcm.equipamentos_cache` — promover
      termo se ainda não estiver em `docs/glossary.md`)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
