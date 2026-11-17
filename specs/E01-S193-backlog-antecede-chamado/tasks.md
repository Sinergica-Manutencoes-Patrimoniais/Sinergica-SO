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
| 1 | **Inventário antes de codar**: o que `sso_backlog_parcelas` (1218/1219/1830), a composição de pendências (0375) e as 7 migrations de GUT já cobrem | — | — | relatório no `plan.md`; nenhuma tabela nova sem justificativa escrita | **done** — achado: `0375/0377/0890/0895/1830` já cobrem AC-1 a AC-6 inteiro; zero RPC nova; "7 migrations de GUT" era contagem errada (só 4, nenhuma de item de Backlog) |
| 2 | ADR do corte Backlog→Chamado (ordem da transição, bloqueio por `auvo_task_id`, reverso) | — | 1 | revisão humana | **done, 17/11/2026** — `docs/adr/1689-reaproveitar-maquinario-backlog-chamado.md`. Decidido: reusar `0375/0377/0890/0895/1830`, introduzir `'demanda'` (Opção B), wrapper fino `sso_liberar_escopo_backlog` em vez de reescrever |
| 3 | `scripts/inventariar-backlog-legado.mjs` — OS em `status='backlog'` por cliente, com/sem `auvo_task_id` | AC-7 | — | `node scripts/inventariar-backlog-legado.mjs` | todo |
| 4 | Migration: `ALTER TABLE pcm.chamados` CHECK aditivo incluindo `'demanda'` + `pcm.sso_liberar_escopo_backlog` (chama `0890`, transiciona `'aberto'→'demanda'`, audita) | AC-1→AC-5 | 2 | `npx supabase@2.114.0 test db supabase/tests/E01-S193_*.test.sql` | todo — **não é mais 3 RPCs novas**: AC-1/2 usa `sso_compor_backlog_pendencias` (0375) direto, AC-3 usa `sso_priorizar_composicao` (0377) direto, só AC-4/5 precisam do wrapper |
| 5 | Revisão adversarial de `0375`/`0377`/`0890`/`0895`/`1830` (locks, concorrência, autorização, efeito de trigger/notificador) — pedido explícito de `ADR-0665`/`ADR-0670`/`ADR-0151`, nunca feito | — | 2 | achado reproduzido vira teste antes de abrir qualquer gate | **PASS, 17/11/2026** — zero achado alto/médio. Cobertura já existente (`E01-S174_divisao_promocao_guardas.test.sql`, 24 assertions): autorização (42501), revisão otimista (40001), idempotência de retry (mesmo `chamadoId`/`destinoId`), "não cria OS". Tabelas sem `policy` (RLS force + `revoke all`) — padrão são-definer-única-porta já usado em todo o repo, não é gap. Trigger `0143` confirmado no-op pro notificador de Portal em eventos `tipo='criado'` (ADR-0665 já previa). Lock ordering: `0890`/`0895` travam só a própria composição (`for update`), sem segunda trava cruzada — sem risco de deadlock entre os dois comandos. 1 gap de cobertura (não é bug, código já defende via `where id=... and cliente_id=...`): falta teste nomeado de concessão válida em Cliente A + composição de Cliente B → `composicao_indisponivel`; registrado pra entrar na task 8 |
| 6 | Migration: abrir os 6 gates (`sso_backlog_composicao_gate`, `sso_promocao_backlog_gate`, `chamado_os_gate`, `sso_backlog_chamado_gate`, `sso_backlog_parcela_gate`, `sso_divisao_backlog_gate`) + conferir `grant execute` contra `1839` | AC-1→AC-5 | 4, 5 | pgTAP da task 8 | todo |
| 7 | pgTAP: `'demanda'` é dead-end — nenhum dos 44 pontos que leem `chamados.status` aceita Chamado em `'demanda'` (OS, suspensão, união, vínculo) | AC-4 | 4 | pgTAP negado, um caso por RPC tocada | todo |
| 8 | pgTAP: zero OS/Chamado no caminho Pendência→Backlog (AC-1/2); liberação integral e parcial corretas (AC-4/5); não selecionadas intactas | AC-1→AC-5 | 4 | `npx supabase@2.114.0 test db` | todo |
| 9 | pgTAP: concorrência — duas liberações simultâneas da mesma composição não geram dois Chamados (reusa idempotência de `request_id` já em `0890`, só prova que o wrapper preserva) | AC-4 | 4 | pgTAP | todo |
| 10 | pgTAP: RLS FORCE, permitido **e** negado, em cada tabela e RPC tocada | — | 4–7 | `npx supabase@2.114.0 test db` | todo |
| 11 | Reuso de `sso_devolver_parcela_chamado_backlog` (1830) — **não reimplementar**; só cobrir por teste | AC-6 | 1 | pgTAP referenciando 1830 | todo |
| 12 | Migration de classificação do legado, aditiva e auditada; recusa OS com `auvo_task_id` | AC-7 | 3, 6 | pgTAP + relatório antes/depois confere | todo |
| 13 | Migration de guarda: escritor que tente `status='backlog'` é recusado com erro nomeado | AC-8 | 12 | pgTAP negado | todo |
| 14 | `application/backlog-queries.ts` — TanStack Query, `backlogQueryKeys`, invalidação após escrita | — | 4 | `cd apps/web && pnpm vitest run src/features/pcm/application` | todo |
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
