---
name: "docs-adr-1214-historico-rateio-mediado-md"
description: "Documento Sinérgica SO: ADR-1214 — Histórico mediado de rateios"
alwaysApply: false
---

# ADR-1214 — Histórico mediado de rateios

## Decisão

Preparar consulta autenticada ao histórico de rateios por Cliente, Visita e despesa. A entrada confere ator e capacidade `despesa_visita.gerir`, mantém o gate e preserva a função interna privada. Ela não altera rateios, cobrança ou comprovantes.

O estado de cada vínculo é o observado na consulta, não uma fotografia histórica. Páginas são consultas independentes; o relatório não comprova execução ou cobertura integral.

## Gates

Não habilitar antes de testes de sessão, RLS/FORCE, isolamento, revogação, paginação concorrente, precisão dos valores e revisão adversarial.
