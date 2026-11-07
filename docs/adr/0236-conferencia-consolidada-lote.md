---
name: "docs-adr-0236-conferencia-consolidada-lote-md"
description: "Documento Sinérgica SO: ADR-0236 — Conferência consolidada de lote de levantamento"
alwaysApply: false
---

# ADR-0236 — Conferência consolidada de lote de levantamento

## Decisão

Preparar registro explícito e auditável de conferência de cada linha pendente, seguido de decisão de conferência do lote somente quando todas as linhas tiverem conferência ou decisão anterior. Revisões do lote e requestId garantem concorrência/idempotência; confirmação de conferência não cria nem altera cadastros. A consulta mostra totais e pendências. Gate fechado e RPCs revogadas.

## Limites

Registros são declaração do PCM, não prova automática de hierarquia, classificação, unicidade ou vínculos. Fluxos anteriores de incorporação por linha ainda não exigem aprovação prévia de lote e podem ter decidido linhas antes da conferência consolidada: esta fundação não sana esse desvio nem substitui o controle obrigatório do AC-4. Não ativar até integrar e revalidar atomicamente decisões e escritores; sem teste/aplicação.
