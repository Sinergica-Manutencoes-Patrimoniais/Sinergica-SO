---
name: "docs-adr-1280-consulta-estado-campo-md"
description: "Documento Sinérgica SO: ADR-1280 — Consulta PCM do estado de campo"
alwaysApply: false
---

# ADR-1280 — Consulta PCM do estado de campo

Status: proposta local; não aplicada nem homologada.

Preparar leitura paginada por Cliente das OS originadas de tarefas capturadas, com última observação aceita, contagem de conflitos e identificação de contêiner provisório. A consulta exige autorização atual `execucao.validar` no servidor e gate próprio fechado. Ela não altera OS, não encerra Chamado e não comprova que a observação foi validada pelo PCM.

A sequência depende de contrato Auvo ainda não comprovado. Antes de habilitar, validar escopo, revogação, status em eventos fora de ordem, privacidade, paginação, concorrência, RLS/FORCE, desempenho e revisão adversarial. A interface deve distinguir registro de campo de validação PCM.
