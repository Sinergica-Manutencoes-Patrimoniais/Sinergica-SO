---
name: "docs-adr-0792-estado-grupo-quantitativo-md"
description: "Documento Sinérgica SO: ADR 0792 — Inativação e reativação auditadas de Grupo Quantitativo"
alwaysApply: false
---

# ADR 0792 — Inativação e reativação auditadas de Grupo Quantitativo

Preparar comando explícito de mudança do campo `ativo`, sob gate próprio desligado, com motivo, autorização atual por Cliente, revisão otimista, lock por grupo e request idempotente. Não excluir linha, mudar localização, Sistema, quantidade, características ou códigos, nem gerar cadastros no Auvo. A reativação somente atende Grupo não excluído cujo Local, Área, categoria e Sistema ainda sejam válidos no mesmo Cliente; vínculos inválidos exigem correção autorizada, não ajuste implícito.

Consulta separada e paginada apresenta os Grupos inativos ao PCM autorizado. Operação não recalcula automaticamente Planos, ocorrências ou OS: a interface deve alertar e não afirmar impacto completo. Decisão de como tratar dependências de programação precisa de validação integrada antes de ativar; gate permanece desligado. Auditoria preserva fotografias antes/depois, motivo e autoria; repetição idêntica não gera segunda alteração.
