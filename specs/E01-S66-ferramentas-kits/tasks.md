---
name: tasks
description: Decomposição e gates — Kits de ferramentas (agrupamento PCM-only, atribuição/devolução em lote).
alwaysApply: false
---

# Tasks — E01-S66 · Kits de ferramentas

> Depende de E01-S63 mergeada. Marcar owner no ROADMAP. Branch: `feat/E01-S66-ferramentas-kits`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `0089_E01-S66_kits_ferramentas.sql`: `pcm.kits`, `pcm.kit_itens` (kit_id, ferramenta_id, quantidade, `kit_itens` NÃO é append-only — composição pode ser editada), coluna `kit_atribuicao_id uuid` em `ferramenta_movimentacoes` (S63) — RLS FORCE padrão | AC-1, AC-2 | S63 | `pnpm run lint:migrations` | **done** |
| 2 | `domain/kits.ts`: `kitEstaCompleto`/`itensFaltantes` (estoque disponível × composição), `kitAtribuicaoEstaCompleta` (agrupamento por `kit_atribuicao_id` — AC-4), `validarKit`/`validarAtribuirKit` — puro, 10 testes | AC-1, AC-2, AC-4 | 1 | `pnpm run test` | **done** |
| 3 | RPC (**técnica escolhida: `security invoker`, não `definer`** — roda com o papel de quem chama, então os INSERTs/SELECTs continuam sob as MESMAS RLS policies já existentes, sem duplicar checagem de permissão): `pcm.fn_atribuir_kit` aloca N unidades por item num loop, `RAISE EXCEPTION` se faltar 1 — desfaz TUDO da chamada (é 1 função, 1 transação implícita); `pcm.fn_devolver_kit` reaproveita o trigger da S63 pra aplicar a devolução em lote | AC-2, AC-3 | 2 | `pnpm run test` | **done** |
| 4 | `application/kits{-gateway}.ts` + `infrastructure/supabase-kits-adapter.ts`: CRUD kit (editar substitui `kit_itens` por completo — delete+insert, nunca mexe em movimentações já gravadas, AC-5), atribuir/devolver via RPC, `listarAtribuicoesAtivas` (agrupa movimentações por `kit_atribuicao_id`, detecta incompleto) | AC-1–AC-5 | 3 | `pnpm run test` | **done** |
| 5 | `KitsSection.tsx` (componente auto-contido, não página nova — **decisão de escopo**: evitar mexer na navegação grande de `HomePage.tsx`; vive como seção extra em `FerramentasPage.tsx`, mesmo padrão de Reservas/S64): lista de kits com badge completo/incompleto, form de composição (linhas ferramenta+quantidade), atribuir (modal escolhe técnico), "Kits atribuídos" com devolver | AC-1, AC-2, AC-3, AC-5 | 4 | `pnpm run test` | **done** |
| 6 | **Não implementado como pedido literalmente — decisão de escopo.** Em vez de agrupamento visual por kit dentro de `FerramentasPorTecnicoPage`, a mesma informação (técnico, quantas unidades do kit ainda estão com ele, badge "kit incompleto com o técnico") já aparece na seção "Kits atribuídos" do `KitsSection.tsx` (task 5) — evita duplicar a mesma UI em 2 lugares. Se Lucas preferir ver isso também na tela por-técnico, é acréscimo pequeno depois | AC-4 | 4 | — | **decisão: coberto por outro caminho, ver task 5** |
| 7 | pgTAP `supabase/tests/kits_atomicidade.test.sql`: atribuir kit incompleto falha e NÃO deixa nenhuma unidade do item que tinha estoque atribuída (tudo-ou-nada real); kit completo atribui as 3 unidades; devolver kit em lote volta todas a disponível — 8 asserts | AC-2 | 1, 3 | CI `db-tests` (Docker ausente local — não executado aqui) | **done** (escrito, não executado) |
| 8 | Gates + ROADMAP/STATE | todos | 1–7 | `biome check --write .`, `typecheck`, `test` (329 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — pgTAP não roda local (sem Docker), verificação visual não realizada (sem Playwright neste ambiente) |

## Plano de teste
- Unit: kit incompleto (falta 1 unidade de 1 item) não atribui nada.
- pgTAP: falha no meio da transação não deixa 2 de 3 itens atribuídos.
- Playwright: ciclo completo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (editar composição com kit
  já atribuído — AC-5 não deve mexer no passado) · ROADMAP/STATE atualizados
