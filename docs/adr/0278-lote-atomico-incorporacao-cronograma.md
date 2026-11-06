---
name: "docs-adr-0278-lote-atomico-incorporacao-cronograma-md"
description: "Documento Sinérgica SO: ADR-0278 — Incorporação atômica de linhas de cronograma"
alwaysApply: false
---

# ADR-0278 — Incorporação atômica de linhas de cronograma

Status: proposta, não homologada.

Uma solicitação explícita de até 25 linhas distintas é aplicada integralmente ou revertida integralmente, chamando por linha o comando transacional canônico de incorporação já preparado. A ordem é declarada, as revisões do lote e do Plano são checadas no início e a revisão do Plano é encadeada após cada criação. Identificadores internos são gerados na transação; retry usa o identificador persistido do lote. Duplicidades são rejeitadas. O diagnóstico por linha existente deve ser conferido antes do envio; falhas não são classificadas automaticamente como definitivas nem geram resultados parciais.

Este limite é técnico de lote, não regra contratual. Não aprova Plano nem cria ocorrência, OS ou integração externa. Gates existentes e EXECUTE permanecem fechados; testes de transação, concorrência, segurança e revisão adversarial precedem ativação.
