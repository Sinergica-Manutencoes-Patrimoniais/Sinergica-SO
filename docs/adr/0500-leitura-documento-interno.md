---
name: "docs-adr-0500-leitura-documento-interno-md"
description: "Documento Sinérgica SO: ADR-0500 — leitura e recuperação do documento interno"
alwaysApply: false
---

# ADR-0500 — leitura e recuperação do documento interno

Status: proposto; gates fechados, não aplicado nem homologado. A consulta lê o item autorizado, seleção mais recente, documento interno e eventual liberação. Não altera nem remove solicitações incertas, e cada retentativa deve conservar requestId e payload. Documento interno não é fiscal; conversão só vincula ao lançamento existente. Controle de concorrência, permissão, acesso cruzado e retomada exigem testes e revisão antes da ativação.
