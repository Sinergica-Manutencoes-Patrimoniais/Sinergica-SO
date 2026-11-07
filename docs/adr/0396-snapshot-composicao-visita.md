---
name: "docs-adr-0396-snapshot-composicao-visita-md"
description: "Documento Sinérgica SO: ADR-0396 — Snapshot revisado da composição de Visita"
alwaysApply: false
---

# ADR-0396 — Snapshot revisado da composição de Visita

Status: proposta; gates fechados, sem testes ou despacho.

Antes da confirmação PCM, a equipe pode revisar uma projeção explícita e limitada de vínculos de OS e equipe vigentes. O banco compara a prévia apresentada sob lock da Visita e de vínculos/objetos e grava snapshot imutável e auditado; a consulta posterior compara a composição atual, informando ausência, equivalência ou alteração, sem autorizar envio. As fontes de composição são limitadas a 100 OS e 100 membros; exceder o limite falha, sem truncar silenciosamente. Alterações indiretas não representadas e mudanças revertidas não são comprovadas pelo snapshot; questionário, alvo e escopo seguem dependentes de verificação própria. Não altera confirmação ou outbox. Requer testes de lock, escopo e mutações legadas antes da ativação.
