---
name: "docs-adr-1484-fila-preventiva-revisao-md"
description: "Documento Sinérgica SO: ADR-1484 — Vigência na entrada da fila preventiva"
alwaysApply: false
---

# ADR-1484 — Vigência na entrada da fila preventiva

## Contexto
Mesmo com proteção na materialização legada, uma ocorrência já vinculada poderia entrar na fila preventiva após retirada de seu escopo em revisão.

## Decisão
Quando o protocolo de continuidade estiver habilitado, inclusão e confirmação de item na fila exigem a versão vigente no vencimento ou continuidade selada pela revisão. Cancelamento e replay continuam disponíveis; nenhuma OS ou item anterior é alterado automaticamente. Reutiliza a verificação da ADR-1483.

## Limites
Não cobre todos os consumidores de ocorrências, não encerra histórico e não resolve decisões PCM de vencidos. Testar concorrência com revisão, inclusão/confirmar/cancelar, replay e avaliar outras filas antes de habilitar. Sem deploy ou Auvo.
