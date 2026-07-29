---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Operação unifica Chamados no board

> Reestruturação grande, code-only (sem migration). Decisões travadas com o Lucas: (0) tudo vai pro
> board; (2) aba Backlog + coluna Backlog coexistem; (5) clique abre o modal direto.
> Implementada em commits por pedaço coerente, na ordem abaixo.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)          | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------|--------|
| 1  | Nav: `PCM_NAV` vira 1 item "Chamados" → `view=ordens`; remove submenu (Operação/Backlog GUT); switch de `pcmView` redireciona `chamados`/`backlog` pro board | AC-1 | — | typecheck | done |
| 2  | Board: aba "Backlog" (5ª, ao lado do Calendário) renderiza `BacklogGutPage` | AC-3 | 1 | typecheck | done |
| 3  | Board: clicar no card abre o modal de detalhe direto (`aberturaModalSeq`) | AC-6 | — | typecheck | done |
| 4  | Board: botão "Novo Chamado" no topo (extraiu `NovoChamadoModal` pra componente); ao salvar, refetch | AC-2 | — | typecheck | done |
| 5  | Filtros: Cliente (empurrado pro `WHERE`; KPIs client-side quando cliente ativo, RPC não tem o param) | AC-5 | — | typecheck + vitest | done |
| 6  | Métricas: `calcularMetricasOperacao` (backlog / sem técnico / sync Auvo c/ erro) + strip no topo | AC-4 | — | typecheck + vitest | done |
| 7  | Modal de detalhe: quando `chamadoId`, carrega o Chamado e expõe ações (histórico, gerar OS/backlog, cancelar, datas) reusando componentes de `ChamadosPage` | AC-7 | 3 | typecheck | **todo (próximo chunk)** |
| 8  | Limpar redundância: "Ver Chamado" (E01-S116) removido; `chamadoFoco` órfão removido do HomePage | AC-6 (borda) | 1,3 | typecheck | done |

## Estado da implementação
Commit 1 (este): T1-T6, T8 — estrutural + Novo Chamado + filtro Cliente + métricas + clique→modal.
Gates verdes (typecheck/vitest 758/biome). **T7 é o próximo chunk**: migrar as ações por-Chamado
(gerar OS/enviar backlog, cancelar com justificativa, histórico WhatsApp/Zé, datas planejada/
execução) pro modal de detalhe do card — hoje esses componentes ainda vivem em `ChamadosPage`
(não mais renderizada). Até o T7, `chamados.spec.ts`/`atendimento-historico-chamado.spec.ts`
(que exercitam essas ações na tela antiga) ficam **vermelhos** — serão reescritos pro novo fluxo
junto com o T7. `ChamadosPage.tsx` fica como referência até o T7 e será removida/migrada lá.

## Plano de teste
- Unidade: `calcularMetricasOperacao` (vitest verde).
- Aceite: Playwright — menu único abre o board; aba Backlog; "Novo Chamado" cria e aparece;
  filtro Cliente; clicar card abre modal — pendente Lucas.
- Regressão: e2e de nav ajustados (`getByTitle("Chamados")`; backlog via aba). `chamados`/
  `atendimento-historico-chamado` pendentes de reescrita com o T7.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma no que foi implementado; T7 explicitamente adiado pro próximo chunk (não é desvio da
  spec, é fatiamento — a spec inteira segue como alvo).

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável (T7/AC-7 pendente)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
