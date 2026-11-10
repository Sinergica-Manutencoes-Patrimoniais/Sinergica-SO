---
name: "docs-adr-0225-conflito-interclientes-agregado-md"
description: "Documento Sinérgica SO: ADR-0225 — Alerta agregado de conflito entre Clientes"
alwaysApply: false
---

# ADR-0225 — Alerta agregado de conflito entre Clientes

Status: proposta, não homologada.

Diagnóstico opcional identifica, para técnico e semana de uma disponibilidade local, registros de Visitas ou intervalos declarados em outros Clientes que se sobrepõem às Visitas/intervalos do Cliente em questão. Retorna apenas quantidade agregada de registros externos, sem nomes, identificadores, horários ou motivo dos outros Clientes. Além da capacidade local, exige concessão global ativa explícita de `capacidade.gerir`, direta ou por perfil ativo. Não efetua bloqueio ou desconto de horas.

Mesmo agregado pode revelar informação e exige revisão de privacidade e autorização. Dados de RH, indisponibilidades sem fonte estruturada, cobertura histórica, simultaneidade de equipes e deduplicação global continuam desconhecidos. Gate e RPC fechados; antes de ativar são obrigatórios testes de isolamento, revogação e revisão adversarial.
