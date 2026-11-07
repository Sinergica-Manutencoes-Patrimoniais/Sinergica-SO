---
name: "docs-adr-0340-documento-inadequado-publicacao-md"
description: "Documento Sinérgica SO: ADR-0340 — Marcação humana de documento inadequado"
alwaysApply: false
---

# ADR-0340 — Marcação humana de documento inadequado

Prepara-se marcação humana versionada `inadequado` ou `reavaliado`, com motivo e auditoria imutável. Documento inadequado bloqueia novos vínculos e futuras leituras no destino, sem excluir documento, origem ou histórico. A leitura do levantamento permanece separada para conferência autorizada.

Reavaliado apenas retira a marcação: não prova segurança, anonimização nem autorização de publicação. Gate de registro desligado não desativa bloqueio de marcações existentes. Testes de segurança, retenção e concorrência precedem ativação.
