---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Operação (Kanban): Chamado e OS são o mesmo item

> **Fonte da verdade.** Status: rascunho
> Origem: pedido do Lucas (2026-07-29, print do Kanban de OS + 8 pontos). Consolida o modelo mental
> de E01-S99/S101/S114/S116: **o Chamado é aberto e evolui pra OS — é o mesmo item, em fases**. A
> tela de "Ordens de Serviço" passa a ser a tela de "Operação", e o Kanban é o board dessa evolução.

## Contexto de código (verificado no banco linked, 2026-07-29)
- `pcm.ordens_servico` é a tabela unificada real (**2597 linhas**): 2515 já têm `numero` `CH-XXXX`
  (numeração histórica pré-E01-S88), só **82** têm `OS-XXXX` (janela E01-S88, revertida em E01-S99).
  2565 não têm `chamado_id` (importadas do Auvo); a maioria tem `auvo_task_id`.
- `ordens_servico.status` **não tem CHECK constraint** — é texto livre; adicionar um status novo
  (`backlog`) é mudança só de código, **sem migration**.
- Status atuais em uso: `finalizado` (2258), `solicitacao` (297), `em_execucao` (35),
  `planejamento` (4), `cancelado` (2), `corretiva` (1).
- `auvo_detalhes.orientacao` (jsonb) tem a "Orientação" da tarefa Auvo — já extraído por
  `resumoTooltipOrdem`.
- A OS já carrega `local_descricao`, `solicitante`, `origem` na linha (`OrdemRow` no adapter), mas
  esses campos **não** são mapeados pro domínio `OrdemServicoOperacional` hoje.
- `pcm.chamados` (37 linhas) é a tabela leve do fluxo Chamado-first; NÃO é fundida nesta story
  (fora de escopo — risco em 2597 linhas de produção). A unificação é de **UX/apresentação**.

## Resumo
A tela "Ordens de Serviço" vira "Operação"; o Kanban deixa de exibir `OS-XXXX`, ganha coluna
"Backlog", tira o droplist de status do card (troca por "Orientação" do Auvo), e o clique no card
abre o "Resumo da OS" já com os campos de intake do Chamado (local, solicitante, origem) mesclados
e sem duplicação.

## Critérios de aceite

### AC-1: Menu "Operação"
- **Dado** o menu OPERAÇÃO do PCM
- **Quando** o operador olha a navegação
- **Então** o item que hoje é "Ordens de Serviço" se chama "Operação" (o título da página também);
  a rota/`PcmView` interna (`"ordens"`) não muda.

### AC-2: Nenhum card mostra `OS-XXXX`
- **Dado** um card no Kanban/Lista/Timeline/Calendário
- **Quando** o número é exibido
- **Então** nunca aparece `OS-XXXX` — mostra `CH-XXXX` quando o `numero` é CH; quando não é CH mas
  a OS tem `auvo_task_id`, mostra o ID do Auvo (ex.: `Auvo #12345`); só no caso raro sem CH e sem
  Auvo mantém o `numero` cru.

### AC-3: ID do Auvo visível no card quando a OS veio/foi pro Auvo
- **Dado** uma OS com `auvo_task_id`
- **Quando** o card renderiza
- **Então** exibe o ID do Auvo (badge curto), pra rastrear o item no Auvo.

### AC-4: Clicar no card abre o "Resumo da OS"
- **Dado** um card no Kanban (ou Timeline/Calendário)
- **Quando** o operador clica no card
- **Então** o "Resumo da OS" daquele item é exibido (painel de detalhe), sem depender do droplist.

### AC-5: Coluna "Backlog" no Kanban
- **Dado** o Kanban da Operação
- **Quando** carrega
- **Então** existe uma coluna "Backlog" (status `backlog`), posicionável/ocultável como as demais;
  arrastar um card pra ela muda o status pra `backlog`. Ordem sugerida das colunas: Solicitação →
  Corretiva → Backlog → Preventiva → Planejamento → Em execução → Finalizado → Cancelado.

### AC-6: Card sem droplist, com "Orientação"
- **Dado** um card no Kanban
- **Quando** renderiza
- **Então** não tem mais o `<select>` de status (mudar status é arrastando); no lugar, mostra a
  "Orientação" da tarefa Auvo (`auvo_detalhes.orientacao`), truncada pro que couber no card. Card
  sem orientação simplesmente não mostra essa linha.

### AC-7: "Resumo da OS" traz os campos do Chamado, sem duplicar
- **Dado** o painel "Resumo da OS"
- **Quando** exibe os dados
- **Então** inclui os campos de intake que hoje só aparecem no Chamado — **Local**, **Solicitante**
  e **Origem** — além dos que já existem (status, prioridade, categoria, GUT, Auvo, técnico, datas);
  título/cliente/descrição aparecem uma vez só (já estão no cabeçalho, não repetir no corpo).

## Casos de borda e erros
- OS sem `auvo_task_id` e com `numero` já `CH-` → mostra o CH normalmente (caminho comum).
- Arrastar card pra "Backlog" e depois pra "Planejamento" → segue o fluxo de status existente
  (drag muda status); a exigência de técnico+data ao entrar em Planejamento continua sendo feita
  pelo modal de edição da OS (não bloqueia o drag nesta story — ver Fora de escopo).
- `orientacao` muito longa → truncada com reticências, sem quebrar o layout do card.

## Fora de escopo
- **Fundir as tabelas `pcm.chamados` e `pcm.ordens_servico`** — a unificação é de UX; o modelo de
  dados fica como está (risco em 2597 linhas de produção).
- Bloquear o drag pra "Planejamento" até ter técnico+data preenchidos — o fluxo de exigência fica
  no modal de edição já existente; forçar no drag é outra story.
- Remover a página separada "Backlog GUT" (`BacklogGutPage`) — continua existindo; esta story só
  adiciona a coluna no Kanban.
- Migração de dados / renumeração das 82 OS `OS-XXXX` — só muda a **exibição**, não o dado gravado.

## Rastreabilidade
- Código: `HomePage.tsx` (`PCM_NAV`), `OrdensServicoPage.tsx` (título, `DetalheOs`),
  `OsKanbanView.tsx`, `domain/ordens-servico.ts` (helper de número + campos local/solicitante/
  origem), `domain/kanban-colunas.ts` (coluna backlog), `infrastructure/supabase-hub-os-adapter.ts`.
- Estende: E01-S99 (CH único), E01-S114 (nav), E01-S116 (OS↔Chamado).
- ADRs relacionados: —
