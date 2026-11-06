---
name: "docs-adr-1030-historico-supressao-gerador-md"
description: "Documento Sinérgica SO: ADR-1030 — Histórico de supressão do gerador"
alwaysApply: false
---

# ADR-1030 — Histórico de supressão do gerador

Status: preparação privada, não homologada.

Preparar consulta paginada de decisões `suprimida_feriado` registradas pelo gerador para a mesma data e Cliente da declaração consultada. Aplicar escopo de contrato quando explícito, mas indicar que o registro legado do gerador não identifica qual declaração fundamentou a decisão. Não inferir vínculo causal, estado atual da semana ou possibilidade de reativação; não gerar ou remover Visitas.

Função exige ator, capacidades de Plano/Visita, trava de autorização e gate próprio; nasce privada e fechada. História manual e do gerador são fontes diferentes, podendo exigir reconciliação. Validar integridade das regras, histórico de vigências, isolamento, privacidade, paginação, RLS/FORCE, concorrência e revisão adversarial antes de liberar.
