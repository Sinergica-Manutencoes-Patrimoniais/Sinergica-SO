---
name: "docs-adr-0248-edicao-staging-observacao-quantidade-md"
description: "Documento Sinérgica SO: ADR-0248 — Edição auditada de observação e quantidade no staging"
alwaysApply: false
---

# ADR-0248 — Edição auditada de observação e quantidade no staging

## Decisão

Preparar edição explícita dos campos de observação e quantidade da linha em staging, sem reescrever o conteúdo original recebido no lote. Comando exige capacidade de aprovação, revisão e snapshot dos atributos, motivo, flags explícitas de campo, retry e auditoria antes/depois. Alteração inicia novo ciclo de conferência e invalida aprovação anterior. Recusa linha rejeitada e qualquer lote com incorporação/vínculo; não altera cadastro oficial.

## Limites

Quantidade é texto informado, não número validado para incorporação. Integração de evidências, correção de outros campos, reconciliação com planilha e controle fino de rejeições ainda faltam. A nova versão não garante que todos os escritores legados sigam o mesmo bloqueio. Gate/RPC fechados; sem teste/aplicação.
