---
name: "docs-adr-0385-encerramento-explicito-chamado-md"
description: "Documento Sinérgica SO: ADR-0385 — Encerramento explícito e conferido de Chamado"
alwaysApply: false
---

# ADR-0385 — Encerramento explícito e conferido de Chamado

Status: proposta, não homologada.

O wrapper exige decisão PCM, motivo, revisão atual, composição integral declarada e ao menos uma parcela; cada parcela deve estar atendida por OS finalizada do mesmo Chamado/Cliente. Propostas de continuidade pendentes impedem encerramento; as executadas devem apontar para OS de continuação válida e finalizada. Todas as OS existentes devem estar finalizadas e do mesmo Cliente. A transação bloqueia as linhas conhecidas e chama o comando de encerramento canônico 0333, registrando evento imutável e retry; nenhuma OS é alterada.

A spec AC-5 exige escopo integral atendido: rejeição de uma continuação não dispensa parcela pendente. Escritores legados podem não respeitar a mesma ordem de locks, portanto a integridade contra inserções concorrentes não está comprovada. Gate próprio e EXECUTE fechados; testes, integração de escritores e revisão adversarial obrigatórios antes de ativar.
