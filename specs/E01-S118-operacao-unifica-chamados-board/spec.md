---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Operação unifica Chamados no board (menu único, Backlog como aba, ações no card)

> **Fonte da verdade.** Status: rascunho
> Origem: reestruturação pedida pelo Lucas (2026-07-29, 6 pontos 0-5) depois de testar E01-S117.
> Fecha o modelo: **sempre se abre um Chamado; após tratativa ele deriva numa OS que vai pro Auvo —
> é o mesmo item, em fases**. As 3 decisões abertas foram travadas com o Lucas (ver cada AC).

## Contexto de código
- Nav atual (E01-S114/S117): "Chamados" (parent, `view=chamados`→`ChamadosPage`) com filhos
  "Operação" (`view=ordens`→`OrdensServicoPage`, o board) e "Backlog GUT" (`view=backlog`→
  `BacklogGutPage`).
- `OrdensServicoPage` tem 4 abas (Lista/Kanban/Timeline/Calendário), KPIs no topo, filtros
  (busca/status/técnico/categoria/datas), e o painel `DetalheOs` (+ modal "Expandir").
- `ChamadosPage` tem os artefatos a reusar: `NovoChamadoModal` (abrir chamado), `GerarOsModal`
  (gerar OS / enviar backlog), `CancelarChamadoModal`, `DetalheChamado` (datas planejada/execução),
  `HistoricoAtendimentoChamado` (conversa WhatsApp/Zé).
- `chamadosGateway.obter(id)` já existe → dá pra carregar o Chamado vinculado a um card do board.
- `BacklogGutPage()` é auto-contida → pode virar o conteúdo de uma aba.
- Card do board é uma linha de `ordens_servico`; tem `chamadoId` (E01-S116) quando há Chamado de
  origem (32 das 2597 hoje; as demais são Auvo legado sem Chamado).

## Resumo
"Chamados" e "Operação" viram um menu só (o board). Abrir um Chamado passa a ser um botão no topo do
board; Backlog GUT vira uma aba ao lado do Calendário; o topo ganha métricas úteis; os filtros
ganham Cliente (e outros); clicar no card abre o modal de detalhes — e, quando o card tem Chamado
vinculado, o modal expõe as ações do Chamado (histórico WhatsApp, gerar OS/backlog, cancelar, datas).

## Critérios de aceite

### AC-1: Menu único (decisão: "tudo vai pro board")
- **Dado** o menu OPERAÇÃO do PCM
- **Quando** o operador olha a navegação
- **Então** existe um único item (não mais o submenu Chamados→Operação/Backlog) que abre o board da
  Operação; `ChamadosPage` e `BacklogGutPage` deixam de ser itens de navegação (viram,
  respectivamente, o próprio board e uma aba dele).

### AC-2: "Novo Chamado" no topo do board
- **Dado** o board da Operação
- **Quando** o operador clica em "Novo Chamado"
- **Então** abre o modal de abertura de Chamado (reusa `NovoChamadoModal`); ao salvar, o Chamado é
  criado e aparece no board (coluna Solicitação) após o refresh. O botão "Nova OS" antigo dá lugar
  a este (ou os dois convivem se fizer sentido — mas "Novo Chamado" é o primário, ponto 1).

### AC-3: Backlog GUT como aba
- **Dado** as abas do board (Lista/Kanban/Timeline/Calendário)
- **Quando** o board renderiza
- **Então** há uma 5ª aba "Backlog" ao lado do Calendário, com o conteúdo priorizado por GUT
  (reusa `BacklogGutPage`). A **coluna** "Backlog" do Kanban (E01-S117) **continua existindo** —
  aba e coluna coexistem (decisão travada): a aba é a visão priorizada, a coluna é a raia de status.

### AC-4: Métricas úteis no topo
- **Dado** o topo do board
- **Quando** carrega
- **Então** além dos KPIs atuais (Total/Abertas/Planejamento/Execução/Finalizadas/Críticas), mostra
  métricas úteis adicionais — ex.: nº em Backlog, nº aguardando planejamento sem técnico, % com sync
  Auvo pendente/erro. (Conjunto final decidido na implementação, priorizando o que é acionável.)

### AC-5: Filtro por Cliente (e outros) no board
- **Dado** os filtros do board
- **Quando** o operador filtra
- **Então** existe um filtro por Cliente (além dos atuais status/técnico/categoria/data); se houver
  oportunidade clara, também origem e/ou tipo do Hub. Os filtros valem pra todas as abas visíveis.

### AC-6: Clicar no card abre o modal de detalhes (decisão travada)
- **Dado** um card no Kanban (ou Timeline/Calendário/Lista)
- **Quando** o operador clica no card
- **Então** abre direto o modal "Detalhes do item" (o expandido) — não só um painel lateral. O
  painel lateral sai ou vira secundário; há um jeito único e óbvio de ver o detalhe.

### AC-7: Ações do Chamado dentro do modal de detalhe
- **Dado** o modal de detalhe de um card que tem `chamadoId`
- **Quando** o operador abre
- **Então** o modal expõe as ações do Chamado que hoje só existem na `ChamadosPage`: histórico de
  atendimento (WhatsApp/Zé), gerar OS / enviar ao backlog, cancelar com justificativa, e as datas
  planejada/execução. Card sem `chamadoId` (Auvo legado) mostra só o detalhe da OS, sem essas ações.

## Casos de borda e erros
- Card sem `chamadoId` → nenhuma ação de Chamado no modal (não quebra, só não mostra).
- "Ver Chamado" (E01-S116) fica redundante com a unificação — o botão pode sair ou virar "focar no
  board"; não deve navegar pra uma `ChamadosPage` que não existe mais como tela separada.
- Deep-link `view=chamados`/`view=backlog` (se algum código ainda navega pra lá) → redireciona pro
  board/aba equivalente, sem tela morta.

## Fora de escopo
- Fundir as tabelas `pcm.chamados`/`pcm.ordens_servico` (segue valendo o fora-de-escopo de E01-S117).
- Bloquear o drag pra Planejamento até ter técnico+data (segue no modal de edição).
- Reescrever o motor de histórico de atendimento — só reusar o componente existente.

## Rastreabilidade
- Código: `HomePage.tsx` (`PCM_NAV`, switch de `pcmView`), `OrdensServicoPage.tsx` (abas, KPIs,
  filtros, `DetalheOs`/modal), `ChamadosPage.tsx` (extrair modais/ações reusáveis),
  `BacklogGutPage.tsx` (virar aba), `chamados` application/gateway (carregar por id no board).
- Estende: E01-S99/S101/S114/S116/S117.
- ADRs relacionados: —
