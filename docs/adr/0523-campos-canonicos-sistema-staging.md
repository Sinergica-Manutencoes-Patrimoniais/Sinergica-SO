---
name: "docs-adr-0523-campos-canonicos-sistema-staging-md"
description: "Documento Sinérgica SO: ADR-0523 — Campos canônicos de Sistema no staging"
alwaysApply: false
---

# ADR-0523 — Campos canônicos de Sistema no staging

Campos explícitos `tipo`, `descricao`, `categoriaId`, `areaId` e `localId` são registrados em edição auditada separada, sem mapear observações, classificação livre ou referências provisórias. JSON ausente significa não alterar; `null` representa intenção explícita de limpar, sujeita à futura validação oficial. Categoria e posição fornecidas são conferidas no Cliente; código e integração Auvo não são alterados. Edição exige revisão do lote e ausência de conferência vigente ou incorporação; caso já conferido, PCM deve reabrir antes. Enquanto houver edição, incorporação do Sistema fica bloqueada até existir integração de aprovação e aplicação desses campos. Gate desligado; histórico imutável e sem escrita no cadastro oficial. Revisão e testes pendentes.
