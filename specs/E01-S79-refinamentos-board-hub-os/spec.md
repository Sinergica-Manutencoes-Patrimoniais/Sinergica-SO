---
name: spec-E01-S79-refinamentos-board-hub-os
description: Contrato — 3 refinamentos pedidos pelo Lucas após validar S76/S78 local (drag and drop no Board, edição no drawer, grid/tabela do Hub de OS).
alwaysApply: true
tier: pequeno
---

# Spec — Refinamentos: Board de ativos + Hub de OS

## Resumo
Feedback do Lucas (2026-07-20) após validar localmente as entregas de E01-S76/S77/S78: 3 ajustes
de UX, frontend-only, zero migration.

## Origem
> "1. S78 - Drag and drop para atualizar equipamento.
> 2. No menu de ativos, permitir ao clicar em um equipamento ajustar as informações dele.
> 3. PCM > Ordens de Serviço >: A fila de ordens esta tomando a maior parte e o resumo da OS a
> menor precisa inverter. e Troca a visao da ordem por tabela, fica melhor de ver"

(Um 4º item do mesmo feedback — vínculo de Inspeção/Assessment com a Visão 360 do Cliente — é
**investigação, não implementação**: ver `docs/STATE.md`, achados AS-IS do PCM antigo
`pcm-sinergica-v2`. Fora do escopo desta spec; decisão de evolução fica para discussão conjunta.)

## Critérios de aceite

**AC-1 — Mover ativo por drag and drop.** Given o Board de ativos (E01-S78) com um item numa
coluna/subgrupo de Local, When o usuário com `pcm:escrita` arrasta o card pra outra coluna (Local
nível-1) ou subgrupo (sub-local), Then o `local_id` do item é atualizado (reusa `editarEquipamento`)
e o board recarrega refletindo a nova posição. Sem permissão de escrita, o card não é arrastável.

**AC-2 — Editar ativo pelo drawer do Board.** Given o drawer de detalhe do ativo (E01-S78, antes
somente leitura), When o usuário com `pcm:escrita` clica em "Editar", Then abre o mesmo formulário
de edição da tela Equipamentos (`EquipamentoModal`, extraído para `components/` e compartilhado),
salva via `editarEquipamento`, e tanto o drawer quanto o board (colunas) refletem a mudança.

**AC-3 — Hub de OS: grid invertido + fila em tabela.** Given a view "lista" do Hub de Ordens de
Serviço, When a página renderiza, Then a fila de ordens ocupa a coluna estreita fixa (`360px`,
mesmo padrão do `PmocPage.tsx`) e o resumo da OS selecionada (`DetalheOs`) ocupa o espaço
flexível restante (`1fr`) — inversão da proporção anterior (`minmax(420px,1fr)_460px`). A fila
passa a ser uma `<table>` real (colunas Nº/OS/Status/Prioridade) em vez de linhas empilhadas em
`<div>`, com scroll horizontal próprio quando necessário.

## Fora de escopo (vinculante)
- Item 4 do feedback (Inspeção/Assessment ↔ Visão 360) — investigação registrada em `docs/STATE.md`,
  implementação é decisão conjunta futura.
- Mover item entre Áreas diferentes via drag and drop (drag and drop só reordena dentro da Área
  selecionada, que é o escopo do Board atual — E01-S78 já não suporta troca de Área pelo board).

## Rastreabilidade
- `apps/web/src/features/pcm/components/BoardAtivos.tsx` (AC-1)
- `apps/web/src/features/pcm/components/DrawerDetalheAtivo.tsx`,
  `apps/web/src/features/pcm/components/EquipamentoModal.tsx` (novo, extraído de
  `EquipamentosPage.tsx`) (AC-2)
- `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx` (AC-3)
- `apps/web/e2e/board-ativos.spec.ts` (estendido — edição + drag and drop)
