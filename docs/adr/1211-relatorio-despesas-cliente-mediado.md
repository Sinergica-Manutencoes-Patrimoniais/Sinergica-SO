---
name: "docs-adr-1211-relatorio-despesas-cliente-mediado-md"
description: "Documento Sinérgica SO: ADR-1211 — Relatório interno de despesas por Cliente"
alwaysApply: false
---

# ADR-1211 — Relatório interno de despesas por Cliente

## Decisão

Preparar entrada autenticada e mediada para o relatório interno de despesas por técnico, preservando o núcleo privado, sua permissão e gate. A entrada exige identidade do ator, capacidade `despesa_visita.gerir` e escopo do Cliente. O relatório é interno, não publica custos e não gera cobrança.

## Gates

Flag e gate permanecem fechados até testes de RLS/FORCE, isolamento, revogação, concorrência, totais, atribuições históricas e revisão adversarial. O resultado é uma consulta pontual, não prova rateio ou execução física.
