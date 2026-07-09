---
name: tasks
description: Tarefas — enriquecimento de schema + 3 visões novas na tela de Ordens de Serviço.
alwaysApply: false
---

# Tasks — Kanban/Timeline/Calendário de Ordens de Serviço

| # | Tarefa | AC | Status |
|---|--------|----|--------|
| 1 | Migration `NNNN_E01-S38_enriquece_ordens_servico_auvo.sql` — 6 colunas novas nullable em `pcm.ordens_servico` | AC-1..3 | pendente |
| 2 | `os-from-task.ts` — `montarLinhaOs`/`OsRowParams` ganham os campos novos; `resolverClienteIdsPorAuvoIds`-like para técnico (`resolverFuncionarioIdsPorAuvoIds`) | AC-1, AC-2 | pendente |
| 3 | `pcm-auvo-tasks-import/index.ts` — extrai `idUserTo`/`taskDate`/`checkInDate`/`checkOutDate`/`address` da tarefa e passa pro insert em lote | AC-1, AC-2 | pendente |
| 4 | `pcm-auvo-webhook/index.ts` — mesma extração pro caminho de 1 tarefa (evento em tempo real) | AC-1, AC-2 | pendente |
| 5 | `OrdemServicoOperacional` (domain) + `hub-os-adapter.ts` — expõe os campos novos na leitura | AC-4..8 | pendente |
| 6 | Aba **Kanban** — colunas por status, mudança via `alterarStatus` | AC-4, AC-5 | pendente |
| 7 | Aba **Timeline por técnico** — agrupamento + posicionamento por check-in/check-out/data agendada | AC-6, AC-7 | pendente |
| 8 | Aba **Calendário** — mês/semana por `data_agendada` | AC-8 | pendente |
| 9 | Testes de domínio (mapeamento dos campos novos, agrupamento da timeline, filtragem do calendário) | todos | pendente |
| 10 | Gates (`pnpm run ci:local`) + teste manual em browser (dev server) | todos | pendente |

**Pré-requisito:** `design.md` aprovado por Lucas antes da task 1 (schema change em tabela com 2364
linhas de produção — tier arquitetural, CLAUDE.md).
