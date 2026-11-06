---
name: "docs-adr-1590-excecao-visita-protegida-md"
description: "Documento Sinérgica SO: ADR 1590 — Exceção aprovada de Visita protegida"
alwaysApply: false
---

# ADR 1590 — Exceção aprovada de Visita protegida

## Contexto
AC-3 de S166 exige preservar exceções aprovadas em mudança contratual. A prévia pura recebe `VisitaProtegida` com `excecao_aprovada`, mas a Visita persistida não registra esse fato.

## Decisão
Registrar aprovação explícita e auditada para uma Visita identificada do Cliente, com revisão, data civil, origem, natureza e motivo fotografados. Usa `plano.gerir`, capacidade que exige concessão individual, além da capacidade de Visita e da mesma coordenação de autorização já adotada. O gate da nova escrita nasce fechado. Nenhuma exceção é inferida de data, alvo, reprogramação ou registros antigos. Mudança de dia preserva toda Visita com registro aprovado e mantém seus identificadores e histórico; lock das fontes impede corrida entre aprovação e mudança. Nova gravação e repetição revalidam a autorização.

## Limites
Cobre exceção aprovada vinculada a Visita existente, conforme modelo `VisitaProtegida`. Não cria Visita, altera OS ou comunica Auvo; não decide regra para exceções que não apontem a uma Visita. Homologação requer UI, testes de concorrência, autorização/revogação, integração de prévias/indicadores, revisão adversarial e CI. Reversão desabilita o gate, preservando registros e proteção para histórico.
