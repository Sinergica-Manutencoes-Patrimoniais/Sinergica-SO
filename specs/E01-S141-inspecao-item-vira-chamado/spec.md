---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório de Inspeção: item vira Chamado pendente

> **Fonte da verdade.** Origem: Lucas (2026-08-10, print do relatório de inspeção INSP-0027). "No
> relatório de inspeção, cada item deve ter a opção de virar um item de chamado de tratamento
> pendente para ser priorizado até virar uma OS (fluxo de chamado → OS)."

## Contexto de código
- `pages/InspecoesPage.tsx`: tela de Relatórios de Inspeção. Lista lateral de inspeções + painel de
  detalhe com os itens (`ItemInspecaoCard`, linha ~731). Cada item mostra sistema, resultado
  (Conforme/Não conforme/Atenção/N-A), grau de risco, descrição, localização — hoje só com ações
  "Editar"/"Excluir".
- `domain/inspecoes-laudos.ts`: `InspecaoItem.destino: DestinoItemAssessment | null` — campo já
  existe (E01-S90) mas hoje só é setado no fluxo de **importação em lote** (checkbox "criar
  Chamados" do `ImportarRelatorioModal`, linha ~347), nunca por item individual numa inspeção já
  existente/concluída.
- `domain/assessment.ts`: `DestinoItemAssessment = "chamado" | "backlog" | "os"`,
  `validarDerivarItem` (impede derivar duas vezes — `destino` precisa ser `null`).
- `application/assessment.ts`: `derivarItemParaChamado(gatewayQualidade, gatewayChamados, item,
  clienteId, responsavel, userId)` — **já genérica**, não depende de `eAssessment`; cria o Chamado
  (`origem: "inspecao"`, `origemInspecaoItemId`) e marca o item como derivado. É a mesma função que
  esta story vai chamar, só que disparada por item, na tela de detalhe da inspeção.
- Pipeline downstream (sem mudança): Chamado criado aparece no board de Chamados/OS
  (`OrdensServicoPage.tsx`, coluna Solicitação, E01-S117/S118) como card pendente de tratamento, de
  onde é priorizado (Backlog GUT) até virar OS — é exatamente o "fluxo de chamado → OS" pedido.

## Resumo
Cada item de uma inspeção (qualquer relatório, não só assessment) ganha uma ação **"Abrir
chamado"**. Ao clicar, cria um Chamado vinculado àquele item (mesma função `derivarItemParaChamado`
já usada na importação em lote) e o item passa a mostrar um selo indicando que já foi derivado — sem
permitir abrir um segundo Chamado pro mesmo item. O Chamado nasce na fila de tratamento normal
(Solicitação → Backlog GUT → Planejamento → OS), sem atalho ou fila especial.

## Critérios de aceite

### AC-1: Ação "Abrir chamado" no item
- **Dado** um item de inspeção sem `destino` (ainda não derivado)
- **Quando** o operador (com escrita em `pcm`) vê o card do item
- **Então** existe uma ação "Abrir chamado" visível/acessível no card.

### AC-2: Confirmação e criação
- **Dado** o operador aciona "Abrir chamado" num item
- **Quando** confirma (evita clique acidental — reusa padrão de confirmação já usado nas exclusões
  da tela, ex. `handleExcluirItem`)
- **Então** chama `derivarItemParaChamado` com o item, o `clientId` da inspeção e o usuário logado;
  o Chamado nasce com `titulo = item.descricao`, `origem = "inspecao"`,
  `origemInspecaoItemId = item.id`.

### AC-3: Item marcado como derivado
- **Dado** um Chamado criado a partir de um item
- **Então** o item recarregado mostra `destino = "chamado"` e o card exibe um selo (ex. "Chamado
  aberto") no lugar da ação "Abrir chamado" — sem permitir nova derivação (mesma regra de
  `validarDerivarItem`, já valendo no backend/domínio).

### AC-4: Erro tratado
- **Dado** falha ao criar o Chamado (rede, permissão, etc.)
- **Então** a tela mostra erro claro (reusa o padrão `erroAcao` já existente na página) e o item
  continua com a ação "Abrir chamado" disponível (não fica em estado intermediário quebrado).

### AC-5: Somente leitura sem escrita
- **Dado** um usuário sem permissão de escrita em `pcm`
- **Então** não vê a ação "Abrir chamado" (mesma checagem `temEscrita` já usada nas outras ações da
  tela).

## Casos de borda e erros
- Item já derivado por outro caminho (ex.: veio de um assessment importado com "criar Chamados"
  marcado): já nasce com `destino` preenchido — card mostra o selo direto, sem a ação.
- Inspeção sem `clientId` resolvido: não deveria ocorrer (toda inspeção tem cliente obrigatório na
  criação) — se ocorrer, erro claro em vez de Chamado com cliente vazio.

## Fora de escopo
- Derivar direto para Backlog/OS por item nesta tela (`derivarItemParaOsOuBacklog`) — só "virar
  Chamado" foi pedido; o item já evolui pra OS pelo fluxo normal do Chamado.
- Ação em lote (selecionar vários itens e abrir Chamado pra todos de uma vez) na tela de detalhe —
  já existe no fluxo de importação; aqui é ação por item.
- Mudar o pipeline Chamado→Backlog→OS — reusado como está.

## Rastreabilidade
- Código: `pages/InspecoesPage.tsx` (`ItemInspecaoCard`), `application/assessment.ts`
  (`derivarItemParaChamado`, sem mudança de assinatura), `domain/assessment.ts`
  (`validarDerivarItem`, sem mudança).
- Reusa: E01-S90 (destino do item), E01-S99/E01-S117/S118 (Chamado é fase inicial da OS).
- ADRs relacionados: —
