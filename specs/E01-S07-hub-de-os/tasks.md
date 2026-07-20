---
name: tasks-E01-S07-hub-de-os
description: Tasks — engine de classificação/prioridade do Hub de OS + migration aditiva + UI de fila.
alwaysApply: false
---

# Tasks — E01-S07: Hub de OS

## Plano
| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Migration `0101`: `pcm.ordens_servico` ganha `tipo_os text` (check C1/C2/P1/P2/IN, nullable) + `pmoc_schedule_id uuid` (FK `pmoc_schedules`, `not valid`) | AC-1 | `pnpm run lint:migrations` | ☐ |
| 2 [P] | domain `hub-os.ts`: `inferirTipoOsHub(categoria, pmocScheduleId)`, `calcularPrioridadeHub(tipoOs, dataAgendada, hoje)`, `calcularPrazoSlaOs(tipoOs, createdAt, dataAgendada)` + `.test.ts` | AC-1, AC-2, AC-3 | `pnpm test` | ☐ |
| 3 | application `abrir-ordem-servico.ts`: chama `inferirTipoOsHub` ao criar, grava `tipo_os` (AC-1); nunca reinfere em edição (AC-4) | AC-1, AC-4 | `pnpm typecheck` | ☐ |
| 4 | infra `supabase-ordem-servico-adapter.ts`: persiste/lê `tipo_os`/`pmoc_schedule_id`; `ordens-servico.ts` (domínio existente) expõe `prioridadeHub`/`atrasadaHub` computados via `calcularPrioridadeHub` | AC-2, AC-6 | `pnpm typecheck` | ☐ |
| 5 | UI `OrdensServicoPage.tsx`: nova visão/filtro "Hub" (badge tipo + prioridade, ordenado, sinaliza P1 atrasada); demais views intactas | AC-5, AC-6 | `pnpm build` | ☐ |
| 6 | Reconciliar ROADMAP + STATE | — | `pnpm run ci:local` | ☐ |

Migration `0101` é aditiva (colunas nullable, sem backfill obrigatório) sobre tabela de produção com
2364+ linhas — `not valid` na FK, sem `validate constraint` nesta story (baixo risco, nenhuma coluna
`not null`, não há necessidade de validar de imediato).

## Plano de teste
- **Unidade (Vitest):** `inferirTipoOsHub` (todas as 6 categorias, com/sem `pmocScheduleId`);
  `calcularPrioridadeHub` (C1/C2/P1 atrasada/P1 no prazo/P2/IN/sem tipo); `calcularPrazoSlaOs`
  (4h/72h/janelas ±3d/±7d/indefinido); borda de `dataAgendada` nula.
- **RLS:** nenhuma nova (reusa as policies já existentes de `ordens_servico`).
- **Aceite:** manual/Playwright se houver tempo — abrir visão Hub, conferir ordenação e badge de P1 atrasada.

## Divergências (SPEC_DEVIATION)
(nenhuma — a decisão de arquitetura já é o próprio propósito desta story, registrada no `design.md`/ADR-0010, não é desvio de um design prévio)

## Definition of Done
- [ ] AC-1..AC-6 verdes pelo gate executável
- [ ] `pnpm run ci:local` verde
- [ ] Migration `0101` aplicada em produção (pedir autorização antes — mesma disciplina da sessão)
- [ ] ROADMAP + STATE atualizados
- [ ] "Dias preventivos" e produtor de `pmoc_schedule_id` explicitamente marcados como fora de escopo, não simulados
