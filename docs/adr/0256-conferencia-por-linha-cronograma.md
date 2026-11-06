---
name: "docs-adr-0256-conferencia-por-linha-cronograma-md"
description: "Documento Sinérgica SO: ADR-0256 — Conferência conjunta de linha de cronograma"
alwaysApply: false
---

# ADR-0256 — Conferência conjunta de linha de cronograma

Status: proposta, não homologada.

Consulta reúne a última declaração de classificação, identidade, mapeamento e situação de cada linha de um lote. A conferência declarada não é atual quando outro registro de identidade, mapeamento ou situação da mesma linha for posterior. Para dado não rejeitado, a consulta indica também a ausência de identidade e mapeamento. Cabeçalho, ignorada e rejeitada não são incorporáveis por inferência. Apenas evidencia lacunas de staging, não verifica validade atual do alvo, configurações contratuais nem autorização de aprovação.

O comando de aprovação é preparado fail-closed: não grava aprovação e não gera Rotina. Política aplicável, separação de responsabilidades e incorporação idempotente precisam ser comprovadas antes de qualquer ativação. Gate e EXECUTE fechados, sem efeitos oficiais; rollback operacional por gate fechado.
