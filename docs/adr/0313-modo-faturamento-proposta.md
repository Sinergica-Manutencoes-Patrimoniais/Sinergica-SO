---
name: "docs-adr-0313-modo-faturamento-proposta-md"
description: "Documento Sinérgica SO: ADR-0313 — Exclusividade entre proposta integral e linhas"
alwaysApply: false
---

# ADR-0313 — Exclusividade entre proposta integral e linhas

Status: proposta; gate fechado, testes e revisão pendentes.

Uma escolha humana auditada define, por proposta operacional e Cliente, faturamento integral ou por linhas. Não há troca automática de modo: correção exige fluxo futuro de estorno e revisão. O servidor serializa escolha e criação de candidatos pelo lock da proposta; trigger valida modo, origem, vínculo, valor e versão na criação/alteração de origem do item, impedindo simultaneidade dos dois modelos. Linhas ainda não geram candidatos nesta etapa. O controle não cobre candidatos legados com tipos de origem desconhecidos: ativação exige inventário, reconciliação e teste de migração de dados. Gate desligado não protege o fluxo; não habilitar emissão por proposta sem habilitação coordenada deste controle e revisão das permissões.
