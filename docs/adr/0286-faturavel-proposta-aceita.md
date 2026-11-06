---
name: "docs-adr-0286-faturavel-proposta-aceita-md"
description: "Documento Sinérgica SO: ADR-0286 — Candidato faturável de proposta operacional aceita"
alwaysApply: false
---

# ADR-0286 — Candidato faturável de proposta operacional aceita

Status: proposta; gate fechado e revisão pendente.

O Financeiro reconhece manualmente uma proposta operacional vinculada a OS e lista do mesmo Cliente, com decisão versionada aceita e preço no snapshot público. A pessoa informa versão, valor e competência para conferência exata; qualquer divergência bloqueia o comando. Um candidato pendente por proposta é criado, nunca documento, lançamento ou cobrança. UUID de pedido e unicidade de origem protegem repetição; dados e decisão são revalidados sob lock. Propostas legadas sem decisão versionada ou snapshot não são inferidas. Ativação requer validação dos contratos entre Comercial, PCM e Financeiro, migrações, permissões e concorrência.
