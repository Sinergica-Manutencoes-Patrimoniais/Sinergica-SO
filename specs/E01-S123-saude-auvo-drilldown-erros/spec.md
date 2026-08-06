---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Saúde Auvo: detalhar os erros (drill-down)

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 4). "Saúde Auvo está reportando 6
> erros, preciso que seja corrigido ou que ao clicar no erro informe quais os erros."

## Contexto de código
- A saúde do sync vem da view `pcm.auvo_sync_health` (migration `0050_E00-S11`), consumida por
  `supabase-dashboard-pcm-adapter.ts` e exibida em `PcmDashboardPage.tsx`. Hoje mostra um **número
  agregado** de erros (6), sem dizer quais entidades falharam nem a mensagem.
- A view agrega `pcm.auvo_entity_status` (por entidade/id, com `last_error`/timestamps — E00-S11).
  O detalhe **existe no banco**, só não é exposto na UI.

## Resumo
O contador de erros da Saúde Auvo vira **clicável**: abre um painel/lista com as N entidades em erro,
cada uma com tipo/id, a mensagem de erro (`last_error`) e quando falhou. Objetivo primário é
**tornar o erro diagnosticável** (não silencioso). Corrigir os 6 erros em si depende do que eles
forem — sai como achado desta story (ver "Casos de borda").

## Critérios de aceite

### AC-1: Clicar no contador abre o detalhe
- **Dado** a Saúde Auvo reportando N erros (N > 0)
- **Quando** o operador clica no indicador de erros
- **Então** abre uma lista com cada entidade em erro: tipo (cliente/tarefa/técnico/…), id, mensagem
  (`last_error`) e data/hora da última falha.

### AC-2: Zero erros → estado saudável, sem drill-down vazio
- **Dado** a Saúde Auvo com 0 erros
- **Quando** o operador olha o painel
- **Então** vê "tudo sincronizado" e o indicador não é clicável (ou abre "nenhum erro").

### AC-3: Mensagem legível, nunca stack cru
- **Dado** um erro com `last_error` técnico
- **Quando** aparece na lista
- **Então** mostra a mensagem de forma legível (mesma pegada de `edge-function-error`), sem vazar
  stack/segredo.

## Casos de borda e erros
- **Correção dos 6 erros atuais:** depende de inspecionar `pcm.auvo_entity_status` em produção —
  provavelmente entidades sem `auvo_id`, credencial, ou payload inválido. A story entrega a
  **visibilidade**; a correção de cada caso vira follow-up (documentar os 6 no tasks.md ao rodar).
- Entidade em erro que depois sincroniza: sai da lista quando `auvo_entity_status` limpa o erro.

## Fora de escopo
- Botão "retentar sync" por entidade (bom follow-up, mas não pedido agora).
- Alertas/notificação proativa de erro (push/e-mail).

## Rastreabilidade
- Código: `infrastructure/supabase-dashboard-pcm-adapter.ts` (query do detalhe),
  `pages/PcmDashboardPage.tsx` (drill-down UI), `lib/http/edge-function-error.ts` (legibilidade).
- Banco: view `pcm.auvo_sync_health` / tabela `pcm.auvo_entity_status` (migration `0050`) — só leitura.
- Estende: E00-S11 (saúde de sync / fim do no-op silencioso).
- ADRs relacionados: —
