---
name: tasks
description: Decomposição e gates — dashboard comercial com métricas de funil agregadas server-side.
alwaysApply: false
---

# Tasks — E03-S08 · Dashboard comercial

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S08-dashboard-comercial`. **Depende de S02 mergeada.**
> Antes de desenhar qualquer gráfico, **carregar a skill `dataviz`** (mesmo caminho da E04-S03).

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN_E03-S08_rpcs_dashboard.sql`: `fn_conversao_etapas(inicio, fim)`, `fn_ciclo_venda(inicio, fim)` (mediana), `fn_win_loss(inicio, fim)`, `fn_ticket_medio(inicio, fim)`, `fn_origem_leads(inicio, fim)` — com guarda de permissão `comercial:leitura`; nenhuma divide por zero | AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-9 | — | `pnpm run lint:migrations` | done |
| 2 | RPC `fn_desconto_medio(inicio, fim)` — só faz sentido com S04; retorna marcador explícito de "sem dados" quando `comercial.propostas` não existe ou está vazia | AC-6, AC-8 | 1 | `pnpm run lint:migrations` | done |
| 3 | `domain/metricas-comercial.ts`: formatação e classificação puras (`amostraPequena`, `taxaConversao` protegendo divisão por zero, rótulo da fonte usada no ticket médio) — reusar `amostraPequena` da E04-S13 se já estiver em `packages/` | AC-5, AC-9 | — | `pnpm run test` | done |
| 4 | Gateway + adapter chamando as RPCs, com o marcador de "sem dados" viajando intacto até a UI (nunca convertido em 0) | AC-1, AC-8 | 1, 2 | `pnpm run test` | done |
| 5 | `DashboardComercialPage`: seletor de período + blocos de conversão, ciclo, win/loss, ticket médio, desconto e origem | AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | 4 | `pnpm run test` | done |
| 6 | Gráficos SVG próprios seguindo a skill `dataviz` e o padrão da E04-S03 (`FluxoMensalChart` como referência) — funil de conversão e distribuição de motivos de perda; **não** introduzir biblioteca de gráfico | AC-2, AC-4 | 5 | `pnpm run test` | done |
| 7 | Estados honestos: "sem dados ainda" quando a story-fonte não existe (AC-8), estado vazio por bloco (AC-9), aviso de amostra pequena | AC-8, AC-9 | 5 | `pnpm run test` | done |
| 8 | Navegação + gate `podeAcessar('comercial', ...)`; dashboard é o item default do módulo (padrão do Financeiro, E04-S03) | AC-10 | 5 | `pnpm run test` | done |
| 9 | pgTAP `supabase/tests/comercial_dashboard_rls.test.sql`: cada RPC negando sem `comercial:leitura`; período vazio retornando linha zerada sem erro; oportunidade reaberta contando o último fechamento | AC-1, AC-9 | 1, 2 | CI `db-tests` | done |
| 10 | `pnpm run ci:local` + Playwright (dev server local): dashboard carrega sem erro de console, tema claro/escuro, período vazio mostra estado vazio + ROADMAP/STATE | todos | 1–9 | `pnpm run ci:local` | done |

## Plano de teste
- **pgTAP**: as RPCs com período vazio (divisão por zero é o defeito clássico aqui) e com
  oportunidade reaberta (o ciclo precisa usar o último fechamento, não o primeiro).
- **Unit**: `taxaConversao(0, 0)` não pode ser `NaN`; `amostraPequena` no limite.
- **Playwright**: carregar sem erro de console em ambos os temas — o mesmo gate que pegou
  problemas reais na E04-S03.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Mostrar 0 onde o certo é "sem dados" | AC-8 + marcador viajando até a UI (task 4), nunca convertido em número |
| Média em vez de mediana no ciclo (outlier distorce) | AC-3 explícito; unit test com outlier |
| Métrica quebrar quando alguém renomear etapa | Métricas usam `tipo`, não nome (AC dos casos de borda) |
| Agregar no browser conforme o volume cresce | AC-1: tudo em RPC |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Skill `dataviz` seguida nos gráficos
- [ ] Revisão adversarial (borda: período vazio, 1 oportunidade, oportunidade reaberta, etapa renomeada)
- [ ] ROADMAP/STATE atualizados
