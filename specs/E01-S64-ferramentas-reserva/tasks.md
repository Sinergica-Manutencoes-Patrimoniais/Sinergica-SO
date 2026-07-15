---
name: tasks
description: Decomposição e gates — reserva de ferramenta por período.
alwaysApply: false
---

# Tasks — E01-S64 · Reserva por período

> Depende de E01-S63 mergeada. Marcar owner no ROADMAP. Branch: `feat/E01-S64-ferramentas-reserva`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `0087_E01-S64_ferramenta_reservas.sql`: `pcm.ferramenta_reservas` (unidade opcional = "qualquer disponível", funcionario, período `data_inicio`/`data_fim`, status `pendente/efetivada/cancelada`). Trigger `fn_validar_reserva_ferramenta` (não exclusion constraint/GiST — evita depender de `btree_gist`, extensão nunca usada neste repo, sem como verificar disponibilidade no Supabase daqui) rejeita conflito de intervalo pra reserva de UNIDADE ESPECÍFICA; RLS FORCE padrão | AC-1, AC-2 | S63 | `pnpm run lint:migrations` | **done** |
| 2 | `domain/ferramenta-reservas.ts`: `validarCriarReserva` (sobreposição pra unidade específica; "pior caso" conservador pra reserva genérica — conta reservas sobrepondo vs unidades ativas), `validarEfetivarReserva`, `validarCancelarReserva`, `ordenarAgendaReservas` — puro, 12 testes vitest (inclusive borda: intervalo que só toca a borda de outro conta como conflito, deliberadamente conservador) | AC-1, AC-2 | 1 | `pnpm run test` | **done** |
| 3 | `application/ferramenta-reservas{-gateway}.ts` + `infrastructure/supabase-ferramenta-reservas-adapter.ts`: criar/cancelar/efetivar (efetivar orquestra `atribuirUnidadeFerramenta` da S63 + marca reserva `efetivada`), listar reservas | AC-1, AC-3–AC-5 | 2 | `pnpm run test` | **done** |
| 4 | UI: seção "Reservas" em `FerramentasPage.tsx` — form criar (ferramenta→unidade opcional "qualquer disponível"→técnico→datas), agenda ordenada (só pendentes), botões Efetivar (modal escolhe unidade se genérica) e Cancelar | AC-1, AC-3–AC-5 | 3 | `pnpm run test` | **done** |
| 5 | pgTAP `supabase/tests/ferramenta_reservas_rls.test.sql`: leitura não cria reserva; escrita cria (nasce pendente); conflito de intervalo na mesma unidade rejeitado (P0001); reserva sem sobreposição aceita; cancelar/efetivar via UPDATE funcionam (reserva não é append-only como movimentações — pode mudar de status) — 7 asserts | AC-2 | 1 | CI `db-tests` (Docker ausente local — não executado aqui) | **done** (escrito, não executado) |
| 6 | Gates + ROADMAP/STATE | todos | 1–5 | `biome check --write .`, `typecheck`, `test` (317 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — pgTAP não roda local (sem Docker), verificação visual não realizada (sem Playwright neste ambiente) |

## Plano de teste
- Unit: sobreposição (mesmo dia, borda início=fim de outra, sem sobreposição).
- pgTAP: 2 reservas conflitantes → erro.
- Playwright: fluxo completo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (reserva genérica quando
  não há nenhuma unidade livre em nenhum cenário) · ROADMAP/STATE atualizados
