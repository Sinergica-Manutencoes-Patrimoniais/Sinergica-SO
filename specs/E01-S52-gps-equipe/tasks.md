---
name: tasks
description: Decomposição e gates — GPS da equipe (pull /gps + card "Equipe agora").
alwaysApply: false
---

# Tasks — GPS da equipe no PCM

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `GET /gps` com credencial API (campos, filtros de data/usuário, paginação) — registrar amostra no spec | todos | credencial Auvo | manual (curl) | todo |
| 2 | Migration `pcm.gps_posicoes` (RLS FORCE leitura módulo pcm, escrita service_role; unique `auvo_user_id+position_date`; índice por data) + rotina de purge 7d | AC-1, AC-4 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Edge Function `pcm-auvo-gps-pull` (paginação, janela incremental, upsert idempotente) + registro em `config.toml` + entrada no `pcm-auvo-sync-all` e cron | AC-1 | 2 | `deno test` + `pnpm run check:edge-functions` | todo |
| 4 | Consulta "última posição por técnico" (view SQL ou query no adapter) juntando `pcm.funcionarios` | AC-2 | 2 | testes | todo |
| 5 | Card "Equipe agora" no `PcmDashboardPage.tsx` (domain/application/adapter na feature pcm; janela operacional; destaque de posição velha; link maps) | AC-3, AC-5 | 4 | `pnpm run test` + typecheck | todo |
| 6 | pgTAP RLS da tabela nova | AC-1 | 2 | CI `db-tests` | todo |
| 7 | `pnpm run ci:local` + ROADMAP/STATE + validação manual browser | todos | 1-6 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: idempotência do upsert, cálculo de "idade da posição", filtro de janela operacional.
- pgTAP: RLS/grants.
- Manual: sincronizar com conta real, conferir card contra o relatório Monitoramento do Auvo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
