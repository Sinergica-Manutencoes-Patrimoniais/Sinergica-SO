---
name: "docs-adr-0221-diagnostico-conflitos-capacidade-md"
description: "Documento Sinérgica SO: ADR-0221 — Diagnóstico limitado de conflitos de capacidade"
alwaysApply: false
---

# ADR-0221 — Diagnóstico limitado de conflitos de capacidade

Status: proposta, não homologada.

Consulta por disponibilidade semanal identifica sobreposição entre intervalos declarados e Visitas do mesmo técnico/Cliente, e entre Visitas desse técnico no mesmo Cliente. Usa intervalos reais com limites `[início,fim)` e não soma durações, não desconta totais e não declara capacidade suficiente. Resultados são limitados e explicitamente incompletos. Ausência de conflito não prova disponibilidade ou simultaneidade: dados de outros Clientes, RH e especialidades não são cobertos.

Sem bloqueio de planejamento: S172 exige alerta consciente, não proibição. Gate e RPC ficam fechados. Faltam política global de conflito, dados de jornada, deduplicação de demanda, alerta com justificativa integrada ao planejamento, testes e revisão adversarial.
