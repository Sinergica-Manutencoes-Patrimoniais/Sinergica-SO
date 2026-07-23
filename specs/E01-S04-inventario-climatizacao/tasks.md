---
name: tasks-E01-S04-inventario-climatizacao
description: Tasks — espelho pcm_equipment (trigger de banco) + pgTAP.
alwaysApply: false
---

# Tasks — E01-S04: Inventário de climatização (espelho cross-disciplina)

## Plano
| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Migration `0100`: `pcm.pcm_equipment` (RLS FORCE+GRANT) + `fn_pmoc_equipment_espelha_pcm()` (upsert por `pmoc_equipment_id`) + trigger `AFTER INSERT OR UPDATE ON pmoc_equipment` | AC-1, AC-2, AC-3, AC-5 | `pnpm run lint:migrations` | ☐ |
| 2 | pgTAP `pcm_equipment_mirror.test.sql`: insert em `pmoc_equipment` espelha; update propaga; RLS select por papel | AC-2, AC-3, AC-5 | `supabase test db` (CI `db-tests`, Docker) | ☐ |
| 3 | Reconciliar ROADMAP + STATE | — | `pnpm run audit:esteira` | ☐ |

Sem código de aplicação — wizard de cadastro (form + import Auvo) já existe em `PmocPage.tsx`,
cobrindo o lado do usuário de AC-2/AC-3 sem mudança.

## Plano de teste
- **pgTAP (`db-tests`, exige Docker — não executável neste ambiente, mesma ressalva recorrente do
  repo):** inserir em `pmoc_equipment` → `pcm_equipment` ganha 1 linha com `discipline='climatizacao'`
  e campos corretos; update em `pmoc_equipment.brand` → espelho atualiza sem duplicar; SELECT por papel
  (`pcm:leitura` lê, sem `pcm` não lê).

## Divergências (SPEC_DEVIATION)
(nenhuma — implementa a Decisão 2 do `design.md` de E01-S03 como escrita, trigger de banco em vez de
Edge Function, que era uma das duas opções já listadas no próprio design: "trigger/Edge Function")

## Definition of Done
- [ ] AC-1..AC-5 — trigger verificado por pgTAP no CI (Docker), gate local (`lint:migrations`) verde aqui
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP + STATE atualizados
