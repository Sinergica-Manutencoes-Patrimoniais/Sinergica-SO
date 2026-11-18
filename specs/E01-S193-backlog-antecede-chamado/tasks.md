---
name: tasks
description: Decomposição e gates de E01-S193. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E01-S193 · Backlog antecede Chamado e OS

Detalhe técnico em `plan.md`. **Tier arquitetural**: ADR antes de implementar, `/revisao-adversarial` antes do PASS.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Inventário antes de codar**: o que `sso_backlog_parcelas` (1218/1219/1830), a composição de pendências (0375) e as 7 migrations de GUT já cobrem | — | — | relatório no `plan.md`; nenhuma tabela nova sem justificativa escrita | todo |
| 2 | ADR do corte Backlog→Chamado (ordem da transição, bloqueio por `auvo_task_id`, reverso) | — | 1 | revisão humana | todo |
| 3 | `scripts/inventariar-backlog-legado.mjs` — OS em `status='backlog'` por cliente, com/sem `auvo_task_id` | AC-7 | — | `node scripts/inventariar-backlog-legado.mjs` | todo |
| 4 | Migration: gate `sso_backlog_pre_chamado_gate` (`default false`) + `sso_enviar_pendencias_backlog` com grant no mesmo arquivo | AC-1, AC-2 | 2 | `npx supabase@2.114.0 test db supabase/tests/E01-S193_*.test.sql` | todo |
| 5 | Migration: `sso_priorizar_item_backlog` (GUT no item, concorrência por `revisao`) | AC-3 | 4 | pgTAP da task 4 | todo |
| 6 | Migration: `sso_liberar_escopo_backlog` — cria Chamado em `demanda`, resto permanece | AC-4, AC-5 | 4 | pgTAP | todo |
| 7 | Guarda explícita do estado `demanda` do Chamado (o `status` é `text` sem CHECK) | AC-4 | 6 | pgTAP negado | todo |
| 8 | pgTAP: zero OS/Chamado no caminho Pendência→Backlog; não selecionadas intactas | AC-1, AC-2 | 4 | `npx supabase@2.114.0 test db` | todo |
| 9 | pgTAP: concorrência — duas liberações simultâneas do mesmo item não geram dois Chamados | AC-4 | 6 | pgTAP | todo |
| 10 | pgTAP: RLS FORCE, permitido **e** negado, em cada tabela e RPC tocada | — | 4–7 | `npx supabase@2.114.0 test db` | todo |
| 11 | Reuso de `sso_devolver_parcela_chamado_backlog` (1830) — **não reimplementar**; só cobrir por teste | AC-6 | 1 | pgTAP referenciando 1830 | todo |
| 12 | Migration de classificação do legado, aditiva e auditada; recusa OS com `auvo_task_id` | AC-7 | 3, 6 | pgTAP + relatório antes/depois confere | todo |
| 13 | Migration de guarda: escritor que tente `status='backlog'` é recusado com erro nomeado | AC-8 | 12 | pgTAP negado | todo |
| 14 | `application/backlog-queries.ts` — TanStack Query, `backlogQueryKeys`, invalidação após escrita | — | 6 | `cd apps/web && pnpm vitest run src/features/pcm/application` | todo |
| 15 | `EnviarPendenciasBacklog.tsx` + `PriorizarItemBacklog.tsx` + `LiberarEscopoBacklog.tsx` | AC-1→AC-5 | 14 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/backlog` | todo |
| 16 | Flag `VITE_SSO_BACKLOG_PRE_CHAMADO_ENABLED` em `FLAGS_SSO` (padrão `false`, `gate` preenchido) + `RecursoNaoAtivado` | AC-F2, AC-F3 | 15 | `node scripts/check-flags-declaradas.mjs` | todo |
| 17 | `backlog` sai de `STATUS_OS` e da coluna do Kanban — **só depois** da task 12 | AC-8 | 12, 15 | `cd apps/web && pnpm vitest run src/features/pcm/domain` | todo |
| 18 | Procedimento de abertura e de retorno escritos e revisados | AC-F4 | 13 | revisão humana; runbook em `runbooks/` | todo |
| 19 | `/revisao-adversarial` — achado reproduzido vira teste | — | 10, 13 | sem achado alto/médio | todo |
| 20 | Linha de ativação no PR: o que falta para a jornada ficar utilizável | AC-F5 | 16 | revisão humana | todo |

## Definition of Done

- pgTAP com permitido **e** negado em cada transição, RLS FORCE (SC-001).
- Nenhuma OS criada no caminho Pendência → Backlog (SC-002).
- Relatório antes/depois sem registro perdido (SC-003).
- Concorrência coberta (SC-004).
- ADR escrito; `/revisao-adversarial` sem achado alto ou médio.
- Migration sequencial sem pular número; atomicidade por `do $$ ... $$` onde necessário.
- CI verde, `db-tests` não pulado.
