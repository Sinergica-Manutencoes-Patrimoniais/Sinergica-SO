---
name: tasks
description: Decomposição e gates — métricas server-side de Atendimento.
alwaysApply: false
---

# Tasks — Métricas server-side de Atendimento

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `design.md`: formato do `SnapshotAtendimento`, onde agrega (SQL RPC vs Deno), estratégia de período/séries | AC-1, AC-3 | — | revisão humana | done |
| 2  | Tipo `SnapshotAtendimento` + função pura `computarSnapshot()` em `domain/` (isolada de I/O) | AC-1, AC-4 | 1 | test de unidade do domínio (datasets sintéticos) | done |
| 3  | RPC/agregação SQL server-side por período (evita cap de 1000) — migration `NNNN_E02-S10_atendimento_metrics.sql` | AC-2, AC-3 | 1 | `supabase test db` (contagens em >1000 linhas) | done |
| 4  | Edge Function `atendimento-metrics`: chama a RPC, monta o snapshot, `requireServiceRole`/JWT conforme matriz | AC-1, AC-2 | 2,3 | `deno test` (mock RPC) | done |
| 5  | Declarar `atendimento-metrics` em `config.toml` (gate E00-S11) | AC-1 | 4 | `node scripts/check-edge-functions.mjs` | done |
| 6  | Gateway/porta + adapter no front (`SnapshotAtendimento` por período) | AC-1, AC-3 | 4 | test do adapter | done |
| 7  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade: `computarSnapshot` — FRT, aging buckets, autonomia, deflexão, delta vs ontem (AC-1, AC-4).
- Integração/pgTAP: agregação correta com >1000 conversas (AC-2), janelas de período (AC-3).
- Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável (Deno/pgTAP no CI)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `atendimento-metrics` declarada em `config.toml`
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
