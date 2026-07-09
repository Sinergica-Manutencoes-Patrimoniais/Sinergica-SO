---
name: tasks
description: Tarefas — enriquecimento de schema + 3 visões novas na tela de Ordens de Serviço.
alwaysApply: false
---

# Tasks — Kanban/Timeline/Calendário de Ordens de Serviço

| # | Tarefa | AC | Status |
|---|--------|----|--------|
| 1 | Migration `0070`/`0071` — colunas novas nullable em `pcm.ordens_servico` (técnico/data/check-in-out) + `auvo_detalhes` jsonb (decisão final: filtro/ordenação vira coluna, resto vira json) | AC-1..3 | ✅ |
| 2 | `os-from-task.ts` — `montarLinhaOs`/`OsRowParams`/`CriarOsDaTarefaInput` ganham os campos novos; `resolverFuncionarioIdPorAuvoId`/`resolverFuncionarioIdsPorAuvoIds` (mesmo padrão de cliente) | AC-1, AC-2 | ✅ |
| 3 | `pcm-auvo-tasks-import/index.ts` — extrai `idUserTo`/`taskDate`/`checkInDate`/`checkOutDate`/`address`/`latitude`/`longitude`/`priority`, resolve técnico em lote, monta `auvo_detalhes` (`montarDetalhes`) | AC-1, AC-2 | ✅ |
| 4 | `pcm-auvo-webhook/index.ts` — mesma extração pro caminho de 1 tarefa (criação + refresh em OS já existente, não só no create) | AC-1, AC-2 | ✅ |
| 5 | `OrdemServicoOperacional` (domain) + `hub-os-adapter.ts` — expõe os campos novos na leitura, join de nome do técnico | AC-4..8 | ✅ |
| 6 | Aba **Kanban** (`OsKanbanView.tsx`) — colunas por status, mudança via seletor por card (não drag-and-drop — mesmo resultado, menor risco) | AC-4, AC-5 | ✅ |
| 7 | Aba **Timeline por técnico** (`OsTimelineView.tsx`) — trilha de 24h por dia selecionado, barra por check-in/check-out, ponto por data agendada | AC-6, AC-7 | ✅ |
| 8 | Aba **Calendário** (`OsCalendarioView.tsx`) — grade de mês (42 dias), chips por `data_agendada` | AC-8 | ✅ |
| 9 | Testes de domínio (`agruparPorTecnico`, `ordensNoDia`, `gerarDiasDoMes`) + testes Deno (`montarLinhaOs` com campos novos, `resolverFuncionarioIdsPorAuvoIds`, `montarDetalhes`) | todos | ✅ |
| 10 | Gates (`pnpm run ci:local`) + teste manual em browser (dev server) | todos | ⏳ (gates locais verdes exceto lint local por falta de memória do sistema; teste em browser pendente até migration deployar) |

**Follow-up não bloqueante:** backfill retroativo das 2364 OS já existentes antes desta story (ficam
com as colunas novas `NULL` até rodar um script pontual, mesmo padrão do backfill de E01-S34).
