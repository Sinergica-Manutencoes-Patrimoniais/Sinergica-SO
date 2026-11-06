---
name: "docs-adr-1106-composicao-aquisicao-e-parcelas-md"
description: "Documento Sinérgica SO: ADR-1106 — Composição com fontes de aquisição e despesas"
alwaysApply: false
---

# ADR-1106 — Composição com fontes de aquisição e despesas

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar comando transacional de orçamento que receba IDs de fontes declaradas de aquisição e parcelas de despesa de Visita. O servidor valida Cliente, OS, lista, revisão e valores, calcula aquisição a partir das fontes próprias e operacional a partir das parcelas, e chama o comando canônico de orçamento. A seleção e fotografia das fontes ficam auditadas e imutáveis; não cria cobrança ou envia proposta.

## Limites

O UUID de cada fonte impede repetição da mesma fonte na composição, mas não prova que registros distintos representem gastos físicos distintos. O caminho antigo de valores manuais e outros consumidores ainda precisam de reconciliação e política de exclusividade; não ativar este fluxo como prova de ausência global de duplicidade. Retificação de fontes, comprovantes, sessão, concorrência, revisões, permissões e revisão adversarial seguem obrigatórios antes de homologação.
