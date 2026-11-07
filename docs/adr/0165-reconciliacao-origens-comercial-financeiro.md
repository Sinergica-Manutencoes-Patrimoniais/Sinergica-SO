---
name: "docs-adr-0165-reconciliacao-origens-comercial-financeiro-md"
description: "Documento Sinérgica SO: ADR-0165 — Consulta de vínculos reais Comercial e Financeiro"
alwaysApply: false
---

# ADR-0165 — Consulta de vínculos reais Comercial e Financeiro

Status: proposta, não homologada.

Triagem usa somente proposta com origem operacional existente e faturável com declaração de repasse e Despesa existentes. Cada consulta exige `integracao.reconciliar` e capacidade do domínio proprietário; não expõe valor, custo, payload ou justificativa. Faturável cuja revisão de Despesa mudou é sinalizado para conferência, nunca alterado ou considerado conciliado automaticamente. Vínculos não encontrados, Cliente divergente e dados ambíguos não são inferidos como sucesso.

Gate S185 e execução continuam fechados. Pendentes integração com todas origens, comparação de versões efetiva, autorização de domínio e custos, versões históricas, resolução pelo domínio proprietário, revisão adversarial e testes. Não cria faturável, lançamento ou evento externo.
