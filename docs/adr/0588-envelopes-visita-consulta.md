---
name: "docs-adr-0588-envelopes-visita-consulta-md"
description: "Documento Sinérgica SO: ADR-0588 — Consulta de envelopes candidatos por Visita"
alwaysApply: false
---

# ADR-0588 — Consulta de envelopes candidatos por Visita

Consulta paginada e autorizada seleciona envelope Auvo com resolução mais recente, Cliente e tarefa coincidentes, OS vinculada à ponte e snapshot histórico conferido pelo resolvedor. Não expõe o payload bruto, cria retorno ou atesta conteúdo; falha fechada se qualquer origem consultada não puder ser comprovada. Nenhum gate ou permissão é ativado.

A adaptação transacional de conferência e reatestação das migrations 0530/0552 permanece bloqueada: a serialização dos escritores e a ordem global de locks não foram comprovadas. A guarda 0729 continua ativa; a consulta não resolve concorrência, testes ou homologação.
