---
name: "docs-adr-0176-classificacao-manual-retorno-campo-md"
description: "Documento Sinérgica SO: ADR-0176 — Classificação manual de retorno identificado"
alwaysApply: false
---

# ADR-0176 — Classificação manual de retorno identificado

Status: proposta, não homologada.

Operador autorizado pode registrar respostas explicitamente classificadas para envelope S175 cuja última resolução identifica OS e Cliente e cuja tarefa ainda corresponde ao ID Auvo da OS. O vínculo OS, ocorrência e snapshot aprovado de Rotina e questionário deve ser comprovado no banco. Identidades das perguntas vêm do snapshot; não se interpreta texto nem se atribui caráter opcional a resposta informada pelo operador. Resultado é `manual_declarado` com cobertura não comprovada e não altera status da OS, ocorrência, Chamado ou Auvo.

Entrada única por envelope, requestId transacional e auditoria preservam rastreabilidade. As RPCs continuam revogadas e gates fechados. Faltam comparação verificável com conteúdo original, evidências, prévia e correção de classificação, fluxo oficial de validação, concorrência, isolamento e testes; não usar esse registro como aprovação ou execução de campo comprovada.
