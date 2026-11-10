---
name: "docs-adr-0567-reconciliar-quarentena-csv-md"
description: "Documento Sinérgica SO: ADR-0567 — Reconciliação de quarentena para staging tipado"
alwaysApply: false
---

# ADR-0567 — Reconciliação de quarentena para staging tipado

Após revisão, servidor valida integralmente a estrutura corrente de todos os registros preservados, independentemente do estado declarado. Somente lote sem erros estruturais pode gerar um lote tipado em staging; nenhuma linha é descartada e nenhum cadastro oficial é alterado. Campos de dados e códigos são preservados literalmente; chaves e tipos são normalizados como no importador existente. A recepção tipada continua sujeita à validação de capacidade, limites, duplicidades, hierarquia e aprovação PCM subsequentes. Revisão de quarentena e idempotência são obrigatórias; gate desligado e sem concessão. Testes e revisão adversarial pendentes.
