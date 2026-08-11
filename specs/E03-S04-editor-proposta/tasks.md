---
name: tasks
description: Decomposição e gates — editor de proposta com composição, cálculo ao vivo, versionamento e ciclo de status.
alwaysApply: false
---

# Tasks — E03-S04 · Editor de proposta

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S04-editor-proposta`. **Depende de S01 e S03 mergeadas.**

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E03-S04_propostas.sql`: `propostas`, `proposta_itens`, `proposta_versoes`; RLS FORCE + policies por `user_modulos.comercial`; `proposta_versoes` **append-only** (nega UPDATE/DELETE para todos, inclusive superadmin) | AC-1, AC-5 | — | `pnpm run lint:migrations` | todo |
| 2 | Migration `NNNN_E03-S04_guardas_proposta.sql`: check/trigger de `preco_centavos >= piso_centavos` com bypass só para superadmin (gravando evento), e trigger de transição de status válida | AC-4, AC-6 | 1 | `pnpm run lint:migrations` | todo |
| 3 | `domain/proposta.ts`: máquina de status (transições válidas), `podeEditar(status)` (AC-7), `estaExpirada(valido_ate)` (AC-9), `proximaVersao` — puras + unit tests de toda transição inválida | AC-6, AC-7, AC-9 | — | `pnpm run test` | todo |
| 4 | `domain/composicao.ts`: agregação dos itens em custo total, delegando o preço/piso/desconto ao `precificacao.ts` da S03 — **sem duplicar fórmula**; unit tests | AC-3 | — | `pnpm run test` | todo |
| 5 | Casos de uso + adapter: criar proposta a partir da oportunidade, CRUD de itens, salvar gerando snapshot, mudar status, duplicar proposta enviada em novo rascunho | AC-2, AC-5, AC-7 | 3, 4 | `pnpm run test` | todo |
| 6 | `PropostaEditorPage`: composição por itens, painel de cálculo ao vivo (custo/preço/piso/desconto máximo), bloqueio visual abaixo do piso com a razão explicada | AC-3, AC-4 | 5 | `pnpm run test` | todo |
| 7 | Formulários por tipo (`volante` técnicos × frequência · `residente` nível + cobertura · `levantamento` com campo `assessment_id` · `simples` livre), todos convergindo para os mesmos itens | AC-8 | 6 | `pnpm run test` | todo |
| 8 | Histórico de versões: lista de snapshots com autor/data e visualização de uma versão anterior (somente leitura) | AC-5 | 5 | `pnpm run test` | todo |
| 9 | pgTAP `supabase/tests/comercial_proposta_rls.test.sql`: RLS nos 4 perfis; `proposta_versoes` recusando UPDATE/DELETE **até para superadmin**; preço abaixo do piso recusado; transição de status inválida recusada | AC-1, AC-4, AC-6 | 1, 2 | CI `db-tests` | todo |
| 10 | `pnpm run ci:local` + Playwright (dev server local): criar proposta→adicionar itens→ver piso→tentar salvar abaixo do piso (barra)→salvar válido→alterar (gera v2)→enviar→tentar editar (bloqueado) + ROADMAP/STATE | todos | 1–9 | `pnpm run ci:local` | todo |

## Plano de teste
- **Unit**: a máquina de status é o ponto denso — testar **toda** transição inválida, não só as
  válidas. `podeEditar` em cada um dos 7 status.
- **pgTAP**: append-only de `proposta_versoes` inclusive para superadmin (é o que garante que a
  peça enviada ao cliente não pode ser reescrita).
- **Playwright**: o ciclo completo até "enviada + tentar editar" — é o AC-7, que protege o cliente.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Fórmula duplicada entre S03 e S04 divergindo com o tempo | Task 4 delega ao `precificacao.ts`; revisão adversarial confere que não há segunda fórmula |
| Proposta enviada mudando por efeito colateral (parâmetro alterado) | AC-7 + snapshot com a alíquota usada |
| Bypass de piso virando hábito | Só superadmin, e grava evento com autor (task 2) |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: proposta sem item, material desativado, desconto = máximo)
- [ ] ROADMAP/STATE atualizados · glossário conferido (**Proposta**, **Piso**)
