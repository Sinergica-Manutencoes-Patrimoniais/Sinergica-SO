---
name: tasks
description: Decomposição e gates — cursor incremental no tasks-import + sync em background com progresso.
alwaysApply: false
---

# Tasks — E01-S67 · Sync incremental + background

## Plano
| # | Task | Cobre AC | Status |
|---|------|----------|--------|
| 1 | Migration `0084_E01-S67_auvo_sync_runs.sql`: tabela `pcm.auvo_sync_runs` (RLS FORCE, select leitura/escrita PCM) + `cron.alter_job` sobe `pcm_auvo_tasks_import_diario` de diário pra horário | AC-8 | done |
| 2 | `pcm-auvo-tasks-import/index.ts`: `calcularInicioJanelaDeCursor` (pura) + `buscarCursorMaxDataAgendada`/`calcularInicioJanela` (consulta `MAX(data_agendada)`); override `startDate` do corpo preservado | AC-1–AC-3 | done |
| 3 | `pcm-auvo-sync-all/index.ts`: `criarRun`/`finalizarRun`/`finalizarRunComErro` + handler responde 202 imediato e roda `runSyncAll` via `EdgeRuntime.waitUntil` (fallback síncrono se `EdgeRuntime` ausente) | AC-4, AC-5 | done |
| 4 | `sincronizar-auvo-gateway.ts`: porta `iniciar`/`consultarRun`/`buscarUltimaRun`; `supabase-sincronizar-auvo-adapter.ts` implementa via Edge Function (iniciar) + select direto em `auvo_sync_runs` (consultar/buscar última) | AC-4, AC-6, AC-7 | done |
| 5 | `sincronizar-auvo.ts`: `deveRetomarAcompanhamento` (pura, limite de 10min) + use cases finos | AC-7 | done |
| 6 | `PcmDashboardPage.tsx`: polling de 3s via `setInterval`, `acompanharRun`/`pararPolling`, `useEffect` de retomada ao montar, cleanup no unmount | AC-6, AC-7 | done |
| 7 | Testes: `index.test.ts` (Deno) do tasks-import ganha 3 casos de `calcularInicioJanelaDeCursor`; `index.test.ts` do sync-all reescrito na E01-S62 já cobre `runSyncAll`; `sincronizar-auvo.test.ts` (vitest) cobre `deveRetomarAcompanhamento` e delegação dos use cases | todos | done |
| 8 | Gates Node: `lint:migrations` (84 migrations), `typecheck`, `test` (296 pass/9 skip), `build`, `check:edge-functions`, `arch:check` | — | verde |

## Ressalvas
- **Deno CLI ausente nesta máquina** (mesma ressalva de sempre) — `calcularInicioJanelaDeCursor`
  tem testes escritos mas não executados aqui; confirmar no CI (`db-tests`/Deno job).
- pgTAP de `pcm.auvo_sync_runs` (RLS: só `service_role` escreve, leitura por módulo PCM) **não
  escrito nesta sessão** — próxima sessão deve adicionar antes de considerar a story 100% fechada.
- `criarRun`/`finalizarRun`/`finalizarRunComErro` em `pcm-auvo-sync-all` não têm teste unitário
  dedicado (CRUD simples contra Supabase, mesmo padrão de `registrarSaudePull` em `pcm-auvo-pull`,
  não testado diretamente no repo hoje).
- Validação end-to-end real (clicar o botão em produção, navegar para outra página, confirmar que
  o sync termina e a run aparece como `succeeded`) **não foi feita** — pendente de acesso
  autenticado ao browser (mesma limitação de sempre nesta máquina).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] AC-1–AC-6, AC-8 implementados e cobertos por teste (unit/Deno, não executado por falta de Deno CLI)
- [ ] AC-7 (retomar ao voltar) — lógica implementada e testada em unit; validação manual em browser pendente
- [x] Gates Node verdes
- [ ] pgTAP de `auvo_sync_runs` — pendente
- [ ] Validação manual em browser autenticado — pendente
