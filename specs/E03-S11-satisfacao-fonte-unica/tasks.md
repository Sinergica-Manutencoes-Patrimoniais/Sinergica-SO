---
name: tasks
description: Decomposição e gates — desativar o sync de satisfação do Auvo e declarar o portal como fonte canônica.
alwaysApply: false
---

# Tasks — E03-S11 · Satisfação: portal é a fonte única

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S11-satisfacao-fonte-unica`. Independente das demais stories E03.
> ⚠️ Toca Edge Function deployada — deploy é passo explícito.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Mapear quem chama `pcm-auvo-support-pull` com `resource: "satisfactions"` (cron `pg_cron`, botão de UI, job) e quem lê `pcm.satisfacao_respostas` — inclusive conferir se o **Relatório Mensal** usa NPS dessa tabela | AC-2, AC-5 | — | `rtk proxy grep -rn "satisfactions\|satisfacao_respostas" .` + `supabase db query --linked` (crons) | todo |
| 2 | `pcm-auvo-support-pull`: remover `satisfactions` da lista de recursos aceitos; chamada com esse valor responde **erro claro de recurso desativado** (não 500). `questionnaires` e `expenses` intocados | AC-1 | 1 | `pnpm run check:edge-functions` | todo |
| 3 | Remover/ajustar os agendamentos e chamadas encontrados na task 1 | AC-2 | 1, 2 | `pnpm run lint:migrations` (se houver cron) | todo |
| 4 | Migration `NNNN_E03-S11_satisfacao_inativa.sql`: `comment on table pcm.satisfacao_respostas` documentando a desativação, a data, a decisão do PO e **como reativar**. Sem drop, sem alterar dado | AC-3 | — | `pnpm run lint:migrations` | todo |
| 5 | `PainelDadosOperacionaisAuvo.tsx`: contagem de satisfação sai ou aparece rotulada como **desativada** — nunca "0 sincronizados" | AC-5 | 2 | `pnpm run test` | todo |
| 6 | Se a task 1 achar o Relatório Mensal lendo NPS da tabela do Auvo, reapontar para `pcm.portal_satisfacao` | AC-4 | 1 | `pnpm run test` | todo |
| 7 | Documentação: `ARCHITECTURE.md` (grupo Satisfação e item 2 da dívida de fronteira) e `glossary.md` (**Satisfação (CSAT/NPS)**) — ambos já redigidos nesta sessão, conferir que batem com o implementado | AC-4 | 4 | `pnpm run audit:esteira` | todo |
| 8 | **Deploy** de `pcm-auvo-support-pull` + smoke test: `questionnaires` e `expenses` respondendo 200, `satisfactions` respondendo o erro de desativado | AC-1, AC-6 | 2 | `supabase functions deploy` + smoke | todo |
| 9 | `pnpm run ci:local` + Playwright (dev server local): painel de diagnóstico sem falso alarme de sync + ROADMAP/STATE | todos | 1–8 | `pnpm run ci:local` | todo |

## Plano de teste
- **Smoke em produção** (task 8) é o gate real: provar que os outros dois recursos não foram
  afetados. Regressão aqui significa parar de sincronizar despesa e questionário.
- **Playwright**: o painel de diagnóstico não pode passar a mentir sobre o estado do sync.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Derrubar `questionnaires`/`expenses` junto | AC-6 + smoke test dos dois (task 8) |
| Cron continuar chamando recurso desativado | Task 1 mapeia, task 3 remove |
| Painel parecer sync quebrado | AC-5 |
| Relatório Mensal perder o NPS | Task 1 confere a fonte antes; task 6 reaponta |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] **Edge Function deployada e smoke-testada** (os 3 recursos verificados)
- [ ] `ARCHITECTURE.md`: item 2 da "Dívida de fronteira" removido · glossário conferido
- [ ] ROADMAP/STATE atualizados
