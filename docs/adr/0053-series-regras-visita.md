---
name: "docs-adr-0053-series-regras-visita-md"
description: "Documento Sinérgica SO: ADR-0053 — Série e versões de regra contratual"
alwaysApply: false
---

# ADR-0053 — Série e versões de regra contratual

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

Uma série identifica o vínculo estável entre Cliente e contrato comercial existente; versões de regra guardam intervalo semanal, dia ISO, âncora de segunda-feira, hora, duração, deslocamento, fuso IANA e vigência em datas civis inclusivas. A integridade do vínculo usa chave composta ao contrato existente. Versões da mesma série não podem ter vigências sobrepostas, inclusive sob concorrência, por constraint de exclusão; séries distintas podem coexistir. Conteúdo e identidade de versão são imutáveis; encerramento de vigência será permitido por comando auditado posterior.

O incremento é apenas fundação aditiva, sem grants de escrita direta e sem geração. Leitura inicial é limitada a `plano.gerir` no Cliente; outros perfis dependem de contrato de autorização. A validação do fuso usa o catálogo PostgreSQL. Não presumir equivalência de contratos financeiros nem converter planos/preventivas legados. Comandos auditados, preview de impactos, exceções, integração E01-S171 e revisão adversarial são necessários antes de liberar operação.
