---
name: "docs-adr-0334-validacao-humana-resposta-evidencia-md"
description: "Documento Sinérgica SO: ADR-0334 — Decisão PCM por resposta e evidência"
alwaysApply: false
---

# ADR-0334 — Decisão PCM por resposta e evidência

Status: proposta, não homologada.

O PCM declara aceitação ou rejeição de uma resposta e de uma evidência privada explicitamente associada a ela. A transação valida Cliente, retorno, resposta, objeto, bucket privado e revisões do conjunto de uploads e da decisão da resposta; motivo e ator ficam auditados em eventos imutáveis. A decisão é humana, não prova autenticidade da imagem, autoria de campo, validade técnica ou execução. Não altera `cobertura_comprovada`, não aprova retorno e não encerra OS ou Chamado.

Gate próprio e EXECUTE nascem fechados. Política de evidência, conteúdo, revogação, testes de concorrência e revisão adversarial ainda são necessários antes de qualquer ativação.
