---
name: "docs-adr-0275-aplicacao-proposta-cronograma-md"
description: "Documento Sinérgica SO: ADR-0275 — Aplicação de proposta de reprocessamento"
alwaysApply: false
---

# ADR-0275 — Aplicação de proposta de reprocessamento

Status: proposta, não homologada.

Aplicação preparada exige proposta existente, lote ainda aprovado na mesma revisão, Plano e versão de Rotina ainda rascunho, revisão do Plano e fotografia dos campos iguais à proposta. Usa o comando canônico de edição, preserva instrução, questionário e tipo de tempo conforme sua regra, mantém o vínculo de origem e grava evento imutável único de aplicação. Alvo é revalidado pelo comando canônico. Mudança concorrente causa falha; não há nova Rotina, ocorrência, OS ou efeito externo. Política normativa, identidade declarada e impacto de calendário continuam sujeitos a revisão humana.

Gates e EXECUTE ficam fechados até testes e revisão adversarial. Rollback operacional mantém os gates fechados; o histórico e os dados não são apagados.
