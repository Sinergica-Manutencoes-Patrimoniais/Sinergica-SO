---
name: "docs-adr-0395-diagnostico-aptidao-chamado-md"
description: "Documento Sinérgica SO: ADR-0395 — Diagnóstico paginado de aptidão do Chamado"
alwaysApply: false
---

# ADR-0395 — Diagnóstico paginado de aptidão do Chamado

Status: proposta, não homologada.

A consulta agrega composição, parcelas, continuidades e OS visíveis ao escopo do mesmo Cliente, sinalizando dados ausentes, OS divergente e inconsistências entre parcela/OS. A listagem por tipo é paginada; dados de uma OS de outro Cliente não são retornados, apenas contados como divergência. Aptidão é fotografia informativa e não autoriza encerramento, pois as fontes podem mudar entre consultas; 0611 deve revalidar sob lock. Ausência de parcelas ou OS e lista incompleta são explícitas.

Sem alteração de Chamado, OS ou integração externa. Gate e EXECUTE fechados, com testes, integração de escritores e revisão adversarial pendentes.
