---
name: "docs-adr-0368-criticidade-explicita-pendencia-md"
description: "Documento Sinérgica SO: ADR-0368 — Criticidade declarada da Pendência"
alwaysApply: false
---

# ADR-0368 — Criticidade declarada da Pendência

A especificação exige exibir criticidade, mas não define escala nem equivalência com GUT. Prepara-se registro humano versionado de texto de criticidade com motivo, auditoria e revisão da Pendência. Valor nulo representa explicitamente não informado; nenhuma classificação, ordenação ou prioridade é inferida. A consulta de um alvo agrega contagens por texto declarado, incluindo não informadas, respeitando Cliente.

Gate e execução nascem fechados. A escala operacional, quando definida, poderá substituir texto livre mediante migração e preservação do histórico. Testes de autorização, concorrência e consumidores de revisão antecedem ativação.
