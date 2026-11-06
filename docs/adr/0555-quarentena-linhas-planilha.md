---
name: "docs-adr-0555-quarentena-linhas-planilha-md"
description: "Documento Sinérgica SO: ADR-0555 — Quarentena de registros estruturalmente rejeitados"
alwaysApply: false
---

# ADR-0555 — Quarentena de registros estruturalmente rejeitados

Todos os registros não vazios analisados de um CSV com rejeições podem ser preservados em lote privado de quarentena, separando registros estruturalmente aptos dos rejeitados por estado declarado, com células textuais, número de registro, motivos declarados, Cliente e responsável. Não preserva bytes originais, cabeçalho ou linhas vazias. Limites de tamanho e autorização são verificados no servidor; repetição idêntica é idempotente. Nenhuma linha é enviada ao staging tipado ou ao cadastro oficial; isso não afirma validade dos diagnósticos enviados. Conteúdo é potencialmente sensível e não deve ser executado como fórmula. Consulta, correção, reconciliação com lote válido e política de retenção exigem implementação própria antes de liberação. Gate desligado; testes e revisão de segurança pendentes.
