---
name: "docs-adr-0373-recuperacao-intencao-local-md"
description: "Documento Sinérgica SO: ADR-0373 — Consulta e recuperação de intenção local"
alwaysApply: false
---

# ADR-0373 — Consulta e recuperação de intenção local

Status: proposta; sem aplicação, testes ou despacho.

O PCM autorizado consulta registros locais bloqueados da própria autoria por Visita, com paginação e filtro opcional de request ID. A consulta não cria intenção, não altera estado e não chama Auvo. A interface pode limpar uma tentativa local somente após confirmar identidade, OS e revisão no registro retornado; ausência ou erro nunca autoriza repetir com novo identificador. Intenções antigas são histórico e não provam elegibilidade atual. Gate e concessões permanecem fechados, dependem de revisão e testes de escopo e concorrência.
