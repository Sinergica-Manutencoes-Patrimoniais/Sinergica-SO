---
name: "docs-adr-0660-selecao-parcial-campos-md"
description: "Documento Sinérgica SO: ADR-0660 — Seleção parcial de campos estruturados"
alwaysApply: false
---

# ADR-0660 — Seleção parcial de campos estruturados

Status: proposta; gates fechados, não homologada.

A interface busca o retrato estruturado e o candidato de código da linha autorizada e exige revisão de lote e confirmação. O servidor 0884 volta a comparar esse retrato e a conferência no ciclo atual; a consulta é apenas prévia e não prova aprovação. Campos ausentes permanecem distintos de campos declarados.

A integração posterior proposta em 0886 permite aos comandos 0756, 0767 e 0845 reconhecer aprovação parcial da própria linha sob as mesmas guardas. A interface distingue essa aprovação da integral. O caminho permanece fechado até a instalação completa, testes e revisão adversarial; o servidor continua validando dependências e retratos.
