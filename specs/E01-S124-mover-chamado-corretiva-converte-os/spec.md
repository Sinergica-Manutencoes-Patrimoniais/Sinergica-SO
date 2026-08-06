---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Mover card da Solicitação para outra coluna converte o Chamado em OS

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 5). "Não estou conseguindo
> habilitar para movimentar os cards no Kanban de Solicitação para Corretiva."

## Contexto de código — causa raiz
- A regra de domínio `deveAlterarStatusPorDrop(origem, destino)` só bloqueia mover pra **mesma**
  coluna (`origem !== destino`). Solicitação→Corretiva é permitido por ela — **não é aí o bloqueio**.
- O bloqueio real: desde E01-S118, os cards da coluna **Solicitação** são **cards sintéticos de
  Chamado sem OS** (`chamadoAbertoParaCard`, id prefixado `chamado-aberto:`). Eles **não são OS
  reais** — `onAlterarStatusDe`/`onToggleSelecionado` fazem early-return via `ehCardChamadoAberto(id)`
  (`OrdensServicoPage.tsx`). Resultado: arrastar um card da Solicitação **não faz nada** (no-op
  silencioso), que é exatamente o sintoma relatado.
- Conceitualmente, mover um Chamado da Solicitação pra Corretiva/Planejamento **é** "Gerar OS" — o
  Chamado deixa de ser card sintético e passa a existir como OS real (`pcm.ordens_servico`) naquele
  status. Já existe `GerarOsModal`/fluxo de conversão (E01-S118 `ChamadoPainel`).

## Resumo
Arrastar (ou usar a ação de mover) um card de Chamado da coluna **Solicitação** para **Corretiva**
(ou outra coluna operacional) dispara a **conversão do Chamado em OS** naquele status — em vez do
no-op atual. Reusa o fluxo "Gerar OS" existente. O caminho para o Auvo respeita a E01-S125 (só
pergunta/abre no Auvo ao ir pra Planejamento; Corretiva cria a OS no PCM sem task Auvo).

## Critérios de aceite

### AC-1: Solicitação → Corretiva converte o Chamado em OS
- **Dado** um card de Chamado aberto na coluna Solicitação (com permissão de escrita)
- **Quando** o operador arrasta o card para a coluna Corretiva
- **Então** o Chamado é convertido em OS real com `status="corretiva"` (mesmo `CH-XXXX`), o card
  sintético some e no lugar aparece a OS real na coluna Corretiva — nada de no-op silencioso.

### AC-2: Feedback claro da conversão
- **Dado** o drop da Solicitação pra Corretiva
- **Quando** a conversão acontece
- **Então** há confirmação/feedback (a OS aparece na coluna destino; erro de conversão é exibido,
  não engolido).

### AC-3: Card sintético não some sem virar OS
- **Dado** que a conversão falha (erro de banco/permião)
- **Quando** o operador soltou o card
- **Então** o card volta pra Solicitação e o erro é mostrado — nunca desaparece sem virar OS.

### AC-4: Sem permissão de escrita, sem mover
- **Dado** um usuário só-leitura
- **Quando** tenta arrastar o card
- **Então** o drag continua desabilitado (comportamento atual de `temEscrita`), sem conversão.

## Casos de borda e erros
- Drop de volta na própria Solicitação: no-op legítimo (não converte), coerente com
  `deveAlterarStatusPorDrop`.
- Card que **já é OS real** (não sintético): mover entre colunas continua sendo troca de status
  normal (comportamento atual), não passa pela conversão.
- Solicitação → Planejamento diretamente: converte **e** entra no fluxo da E01-S125 (pergunta abrir
  no Auvo). Solicitação → Backlog: usar o caminho GUT (E01-S94, GUT obrigatório) — ver dependência.

## Fora de escopo
- A pergunta/dry-run de abrir OS no Auvo (é a E01-S125).
- Reescrever o drag-and-drop (só destravar o caso do card sintético).
- GUT obrigatório ao mandar pro Backlog (já é E01-S94).

## Rastreabilidade
- Código: `pages/OrdensServicoPage.tsx` (handler de drop / `onAlterarStatusDe`, remover early-return
  cego para card sintético e rotear pra conversão), `components/OsKanbanView.tsx` (drop),
  `domain/ordens-servico.ts` (`ehCardChamadoAberto`), `application/chamados.ts` (gerar OS),
  `components/ChamadoPainel.tsx` (fluxo `GerarOsModal` reusado).
- Estende: E01-S118 (cards sintéticos), E01-S117 (Kanban), E01-S61 (drag-drop).
- Depende de: E01-S94 (GUT no backlog), interage com E01-S125 (Auvo sob demanda).
- ADRs relacionados: —
