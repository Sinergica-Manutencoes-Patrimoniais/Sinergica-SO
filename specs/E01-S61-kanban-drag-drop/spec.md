---
name: spec
description: Contrato — arrastar card entre colunas no Kanban de Ordens de Serviço muda o status de verdade.
alwaysApply: true
---

# Spec — Kanban: arrastar card muda status

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Origem: teste manual do Fabrício + Lucas (2026-07-11) — "o Kanban não está dando para
> movimentar os cards entre fases/status". Achado: não é bug de dado — `OsKanbanView.tsx` foi
> desenhado na E01-S38 com mudança de status via `<select>` no rodapé do card, não drag-and-drop
> (decisão documentada no código, menor risco/esforço na época). A expectativa de quem usa Kanban
> é arrastar; a ausência disso lê como "não funciona".

## Resumo
`OsKanbanView` ganha arrastar-e-soltar real entre colunas (HTML5 Drag and Drop API nativo — sem
biblioteca nova) chamando o mesmo `onAlterarStatus` já existente. O `<select>` continua disponível
como alternativa acessível (teclado, leitor de tela, mobile sem suporte a drag touch).

## Critérios de aceite

### AC-1: Arrastar card para outra coluna muda o status
- **Dado** um card na coluna "Planejamento"
- **Quando** o usuário arrasta e solta na coluna "Em execução"
- **Então** `onAlterarStatus(id, "em_execucao")` é chamado (mesmo caminho que o `<select>` já usa)

### AC-2: Feedback visual durante o arraste
- **Dado** um card sendo arrastado
- **Quando** passa sobre uma coluna
- **Então** a coluna de destino indica visualmente que é um alvo válido (borda/realce)

### AC-3: Sem permissão de escrita, sem drag
- **Dado** `temEscrita === false`
- **Quando** a tela carrega
- **Então** os cards não são arrastáveis (mesma regra que já esconde o `<select>` hoje)

### AC-4: Soltar na própria coluna não faz nada
- **Dado** um card solto na mesma coluna de origem
- **Quando** o drop acontece
- **Então** nenhuma chamada de alteração de status é feita (evita PATCH/evento desnecessário)

### AC-5: Falha ao salvar não perde o card visualmente
- **Dado** `onAlterarStatus` falhando (erro de rede/permissão)
- **Quando** o erro ocorre
- **Então** o card continua visível (a tela já trata erro de status via `erroAcao` existente —
  reaproveitar, não duplicar)

### AC-6: Select continua funcionando
- **Dado** o `<select>` de status no card
- **Quando** usado (teclado, mobile, leitor de tela)
- **Então** continua mudando o status normalmente — drag é adição, não substituição

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Reordenar cards dentro da mesma coluna (sem campo de ordem manual no domínio).
- Drag-and-drop em outras views (Lista, Timeline, Calendário).
- Biblioteca de terceiros (`@dnd-kit`, `react-beautiful-dnd` etc.) — API nativa HTML5 é suficiente
  pro caso (mover entre colunas, sem sorting complexo).

## Rastreabilidade
- Complementa E01-S38 (Kanban original) e E01-S43 (ação em lote).
- Arquivo-âncora: `apps/web/src/features/pcm/components/OsKanbanView.tsx`.
