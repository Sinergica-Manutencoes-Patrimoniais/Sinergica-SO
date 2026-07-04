---
name: tasks-E01-S21-dashboard-pcm-real
description: Tasks para trocar mocks do dashboard PCM por dados reais.
alwaysApply: false
story: E01-S21
owner: "@sm"
status: done
created_at: 2026-07-04
---

# Tasks — E01-S21

- [x] T1 — Criar domínio puro de resumo do dashboard PCM.
  - AC: 2, 4
  - Gate: `pnpm --filter @sinergica/web test -- src/features/pcm/domain/dashboard-pcm.test.ts`
- [x] T2 — Criar página `PcmDashboardPage` carregando adapters reais.
  - AC: 1, 2, 3, 4, 5
  - Gate: `pnpm run typecheck && pnpm run build`
- [x] T3 — Conectar HomePage e remover mocks internos do dashboard PCM.
  - AC: 1
  - Gate: `pnpm run lint`
- [x] T4 — Atualizar ROADMAP/STATE e revisar adversarialmente.
  - AC: todos
  - Gate: `pnpm run audit:esteira`

## Resultado

- Removidos os arrays mockados internos do dashboard PCM (`KPIS`, `OS_RECENTES`, `BACKLOG_TOP`).
- Criado domínio `dashboard-pcm` para montar KPIs/listas a partir de `pcm.ordens_servico` e
  `pcm.inspecoes`.
- Criada página `PcmDashboardPage`, que carrega `supabaseHubOsAdapter` e `supabaseQualidadeAdapter`.
- Mantidos como placeholders apenas os cards do dashboard geral de módulos ainda sem fonte de dados.

## Gates

- `pnpm --filter @sinergica/web test -- src/features/pcm/domain/dashboard-pcm.test.ts` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm run test` ✅ — 114 pass / 9 skip
- `pnpm run build` ✅ — warning conhecido de chunk >500 kB

## Revisão adversarial @qa

- AC-1: `HomePage` não contém mais arrays mockados para o dashboard interno do PCM.
- AC-2: KPIs vêm de `ordens_servico` e `inspecoes`; métricas sem fonte real foram substituídas por
  métricas reais (`OS com Auvo`, `Falhas Auvo`, `Preventivas abertas`).
- AC-3/AC-4: listas usam OS reais recentes e backlog real ordenado por GUT.
- AC-5: página trata carregamento, erro e vazio.
- Limite consciente: `DASHBOARD_GERAL` ainda tem placeholders para módulos não implementados.
