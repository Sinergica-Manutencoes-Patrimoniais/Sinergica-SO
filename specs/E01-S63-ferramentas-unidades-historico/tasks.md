---
name: tasks
description: Decomposição e gates — unidades individuais de ferramenta + histórico append-only.
alwaysApply: false
---

# Tasks — E01-S63 · Unidades + histórico

> Marcar owner no ROADMAP. Branch: `feat/E01-S63-ferramentas-unidades-historico`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `0086_E01-S63_ferramenta_unidades.sql`: `pcm.ferramenta_unidades` (código via `default nextval(sequence)` formatado `FER-NNNN`, status `disponivel/atribuida/baixada`), `pcm.ferramenta_movimentacoes` (append-only — sem policy de UPDATE/DELETE pra `authenticated`, mesmo padrão `pcm.os_equipamentos_auvo` de `0017`); trigger `fn_aplicar_movimentacao_ferramenta` deriva o status da unidade a partir da movimentação inserida e valida a transição (raise exception se inválida — defesa em profundidade além do domínio) | AC-1 | — | `pnpm run lint:migrations` | **done** |
| 2 | `domain/ferramenta-unidades.ts`: `validarAtribuicaoUnidade`/`validarDevolucaoUnidade`/`validarBaixaUnidade`/`calcularDivergenciaAuvo` — puro, 10 testes vitest | AC-1–AC-3, AC-6, AC-7 | 1 | `pnpm run test` | **done** |
| 3 | `application/ferramenta-unidades{-gateway}.ts` + `infrastructure/supabase-ferramenta-unidades-adapter.ts`: listar unidades, gerar unidades, atribuir, devolver, baixar, histórico por unidade e por funcionário | AC-2–AC-6 | 2 | `pnpm run test` | **done** |
| 4 | `pcm.ferramenta_alocacoes` (migration `0033`) **permanece como está** — já era só a visão agregada do Auvo (`origem_sync='auvo'`, reconciliada pelo cron), nunca foi tocada pelo fluxo novo. O que mudou: o fluxo manual antigo que gravava alocação passando pelo Auvo (`FerramentaAlocacoesGateway.alocar` → edge function `pcm-auvo-ferramenta-alocacao`) foi **removido** do client (domain/application/adapter/UI) — posse agora é 100% local via `ferramenta_movimentacoes`, sem round-trip pelo Auvo. `listarAlocacoes()` continua existindo, só de leitura, pro badge de divergência (AC-7) | AC-7 | 1 | `pnpm run typecheck` | **done** (decisão: `ferramenta_alocacoes` não mudou de schema, só deixou de ser escrita pelo cliente) |
| 5 | UI: `FerramentasPage` ganha painel expansível de unidades por ferramenta (código + status, botão "Gerar unidades" faz top-up até `quantidade_total`, botão "Baixar" por unidade); `FerramentasPorTecnicoPage` reformulada — form "Atribuir" (ferramenta→unidade disponível→técnico), cards por técnico com unidades atribuídas + botão "Devolver" (condição/motivo) + badge de divergência Auvo inline + modal de histórico completo por técnico | AC-2–AC-7 | 3, 4 | `pnpm run test` | **done** |
| 6 | pgTAP `supabase/tests/ferramenta_unidades_rls.test.sql`: leitura não cria unidade; escrita cria (código auto-gerado, nasce disponível); atribuição aplica trigger (status→atribuída); atribuir unidade já atribuída falha (P0001, invariante); devolução OK volta pra disponível; UPDATE/DELETE em `ferramenta_movimentacoes` negados (append-only) — 11 asserts | AC-1, AC-2, AC-3, AC-4, AC-6 | 1 | CI `db-tests` (Docker ausente local — não executado aqui) | **done** (escrito, não executado — Docker ausente) |
| 7 | Gates + ROADMAP/STATE | todos | 1–6 | `biome check --write .`, `typecheck`, `test` (305 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — pgTAP não roda local (sem Docker), verificação visual em browser não realizada (sem Playwright neste ambiente) |

## Plano de teste
- Unit: código sequencial nunca reaproveitado; atribuir unidade já atribuída falha; baixa é terminal.
- pgTAP: `ferramenta_movimentacoes` rejeita UPDATE/DELETE por policy/trigger.
- Playwright: ciclo completo com 1 ferramenta de 2 unidades.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (atribuir unidade baixada,
  devolver unidade não atribuída) · ROADMAP/STATE atualizados
