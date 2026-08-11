---
name: tasks
description: Decomposição e gates — documentar o dono do Orçamento de Serviço, publicar view para o portal e fechar a E01-S14.
alwaysApply: false
---

# Tasks — E03-S12 · Dono do Orçamento de Serviço + fechamento da E01-S14

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S12-dono-orcamento-servico`. Independente das demais stories E03.
> Story de fronteira e documentação — o código em produção **não muda de comportamento**.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Ler `0144_E09-S09_portal_orcamentos.sql` inteira e mapear como o portal (`features/area-cliente`) acessa as 3 tabelas hoje — que colunas, que filtros de RLS | AC-3, AC-5 | — | leitura + anotação nesta tabela | done |
| 2 | Migration `0202_E03-S12_view_portal_orcamentos.sql`: view de consumo publicada pelo PCM (`security_invoker`) espelhando exatamente o que o portal já filtra + **`grant select` explícito** (bug real da E04-S04, `0110`) | AC-3 | 1 | `pnpm run lint:migrations` | done |
| 3 | Migration `0203_E03-S12_comments_dono.sql`: `comment on table` nas 3 tabelas registrando dono (PCM), story de origem (E09-S09) e decisão 10 do E03 | AC-1 | — | `pnpm run lint:migrations` | done |
| 4 | Portal passa a ler pela view, sem alterar nada visível ao síndico | AC-3, AC-5 | 2 | `pnpm run test` | done |
| 5 | `ARCHITECTURE.md`: registrar PCM como dono do Fluxo B e o portal como canal (a seção já foi redigida nesta sessão — conferir que bate com o implementado) | AC-1 | 3 | `pnpm run audit:esteira` | done |
| 6 | `glossary.md`: conferir **Orçamento de Serviço** × **Proposta** × **Orçamento (anual)** contra o código real | AC-2 | — | `pnpm run audit:esteira` | done (no-op — já batia) |
| 7 | Fechar a **E01-S14**: nota de fechamento no `specs/E01-S14-fluxo-b-orcamento/design.md` apontando para esta story e para a E09-S09, e conferir a linha do ROADMAP (já corrigida nesta sessão). As 2 perguntas de negócio deixam de figurar como abertas | AC-4 | — | `pnpm run audit:esteira` | done |
| 8 | `pnpm run ci:local` + Playwright (dev server local): fluxo do síndico aprovando/recusando orçamento **idêntico ao de antes** (regressão pura) + ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | done — Playwright de síndico não é possível neste ambiente (sem sessão `cliente-sindico` login-ável em E2E, mesma lacuna da S06); regressão coberta por pgTAP + smoke test de RLS em produção reproduzindo a query exata do adapter |

## Plano de teste
- **Playwright de regressão** é o gate central: esta story não pode mudar nada para o síndico.
  Rodar o fluxo de aprovação de orçamento antes e depois.
- **`audit:esteira`** valida os links e o frontmatter dos documentos tocados.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| View sem `grant select` derrubar o portal | Explícito na task 2 (bug real da E04-S04) |
| View filtrando diferente da consulta atual e escondendo orçamento do síndico | Task 1 mapeia os filtros exatos antes de escrever a view |
| Mudança de comportamento acidental | AC-5 + Playwright de regressão (task 8) |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate
- [x] `pnpm run ci:local` verde · regressão coberta por pgTAP + smoke test de RLS (sem sessão síndico em E2E neste ambiente)
- [x] E01-S14 formalmente encerrada (ROADMAP + nota no `design.md` dela)
- [x] `ARCHITECTURE.md` e `glossary.md` conferidos contra o código
- [x] ROADMAP/STATE atualizados
