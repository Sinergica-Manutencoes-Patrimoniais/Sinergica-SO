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
| 7  | Modal de detalhe: quando `chamadoId`, carrega o Chamado e expõe ações (histórico, gerar OS/backlog, cancelar, datas) reusando componentes de `ChamadosPage` | AC-7 | 3 | typecheck | done |
| 8  | Limpar redundância: "Ver Chamado" (E01-S116) removido; `chamadoFoco` órfão removido do HomePage; `ChamadosPage.tsx` removida (tudo migrado) | AC-6 (borda) | 1,3,7 | typecheck | done |

## Estado da implementação (completo)
`ChamadoPainel.tsx` (novo) carrega o Chamado por `chamadoId` e renderiza histórico (WhatsApp/Zé),
datas (planejada/execução) e ações (Gerar OS/Enviar backlog/Cancelar) — sempre que a OS/card tem
`chamadoId`, independente do status. **Requisito do Lucas explicitamente atendido:** o histórico
continua acessível depois do Chamado virar OS — o painel carrega pelo `chamadoId`, nunca pelo
status; só as ações (Gerar OS/Cancelar) somem quando `chamado.status !== "aberto"`.

**Achado ao integrar (correção que não estava no plano original):** um Chamado recém-criado não
tinha `ordens_servico` até "Gerar OS"/"Enviar backlog" — ficaria invisível no board (que só lista
`ordens_servico`), contradizendo o próprio ponto 1 do pedido ("sempre se abre um Chamado, que
evolui pra OS"). Corrigido com `chamadoAbertoParaCard`/`ehCardChamadoAberto` (domínio): Chamados
abertos (`status="aberto"`) viram cards sintéticos na coluna Solicitação, `id` prefixado
(`chamado-aberto:`) pra nunca colidir com um id real de OS — mesclados em `ordensFiltradas` só pra
exibição, nunca gravados como OS. `DetalheOs` esconde as seções só-de-OS (status/GUT/Auvo/Editar)
pra esses cards; `onAlterarStatusDe`/`onToggleSelecionado` ignoram esse id sintético (não é OS
real, não dá pra arrastar/selecionar em lote). Ao "Gerar OS", o card sintético desaparece (Chamado
sai de `status=aberto`) e o mesmo CH-XXXX passa a existir como OS real.

`ChamadosPage.tsx` removida — tudo migrado pro board (`OrdensServicoPage`+`ChamadoPainel`+
`NovoChamadoModal`). `chamados.spec.ts`/`atendimento-historico-chamado.spec.ts` reescritos pro
novo fluxo (nav única, Lista view, clique na linha abre o painel com "Resumo do Chamado" ou
"Resumo da OS").

## Plano de teste
- Unidade: `calcularMetricasOperacao`, `chamadoAbertoParaCard`/`ehCardChamadoAberto` (vitest verde,
  759 testes).
- Aceite: Playwright — menu único abre o board; aba Backlog; "Novo Chamado" cria card sem OS,
  visível na Solicitação; Gerar OS/Enviar backlog/Cancelar funcionam pelo painel; histórico
  continua visível depois de virar OS — pendente teste local do Lucas.
- Regressão: e2e de nav ajustados (`getByTitle("Chamados")`; backlog via aba); `chamados.spec.ts`/
  `atendimento-historico-chamado.spec.ts` reescritos pro novo fluxo.

## Divergências (SPEC_DEVIATION)
- [x] Card sintético de Chamado sem OS (`chamadoAbertoParaCard`) não estava no plano original —
  achado necessário ao integrar (senão Chamados novos ficariam invisíveis no board). Resolvido
  como mapeamento de exibição, sem gravar nada novo no banco nem fundir as tabelas (mantém o
  "fora de escopo" da spec).

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest 759/biome)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
