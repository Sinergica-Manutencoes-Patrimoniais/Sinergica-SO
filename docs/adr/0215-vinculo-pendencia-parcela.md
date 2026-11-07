---
name: "docs-adr-0215-vinculo-pendencia-parcela-md"
description: "Documento Sinérgica SO: ADR-0215 — Vínculo de Pendência a parcela existente"
alwaysApply: false
---

# ADR-0215 — Vínculo de Pendência a parcela existente

## Decisão

Preparar associação explícita e auditada entre uma Pendência da composição vinculada e uma parcela existente do mesmo Chamado, ambas ainda pendentes. O comando compara revisões do Chamado, composição e escopo, verifica Cliente e capacidade, e impõe unicidade de Pendência e parcela. Não cria OS ou parcela e não infere atendimento. Gate fechado e RPC revogada.

## Limites

Unicidade é conservadora e não suporta realocação, cisão ou devolução. Os escritores legados precisam compartilhar as mesmas travas e revisões para provar concorrência; a descrição da parcela não prova equivalência técnica com a Pendência. Associação exige revisão humana e validação antes de ativação. Sem testes/aplicação.
