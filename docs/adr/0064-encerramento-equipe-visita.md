---
name: "docs-adr-0064-encerramento-equipe-visita-md"
description: "Documento Sinérgica SO: ADR-0064 — Encerramento de participação na equipe da Visita"
alwaysApply: false
---

# ADR-0064 — Encerramento de participação na equipe da Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Em Visita rascunho ou planejada, gestor autorizado encerra uma participação vigente com motivo, ator e data, preservando o histórico. A transação bloqueia a Visita, valida revisão, registra auditoria e resultado idempotente. Uma nova participação pode substituir a encerrada, sem reescrever a anterior. O comando não altera a agenda legada, OS ou Auvo. Participação de outra Visita e acesso não autorizado são recusados sem revelar dados.

Visitas confirmadas ou posteriores continuam bloqueadas: edição com invalidação de confirmação e eventual intenção Auvo depende do fluxo transacional completo de E01-S168/S171. Não interpretar este comando como reprogramação ou comprovação de disponibilidade.
