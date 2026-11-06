---
name: "docs-adr-0975-comandos-devolucao-com-ator-md"
description: "Documento Sinérgica SO: ADR-0975 — Identidade explícita nos comandos de ciclo"
alwaysApply: false
---

# ADR-0975 — Identidade explícita nos comandos de ciclo

Status: preparação privada; não homologada.

Preparar mediadores para inicializar o ciclo legado e devolver sua parcela: cada mediador exige que o ator esperado pelo formulário corresponda à sessão autenticada na mesma transação e delega aos comandos existentes, preservando autorização, gates, identidade, recibos e auditoria destes. A inicialização não devolve escopo; devolução continua limitada às precondições conservadoras do ADR-0960 e não prova parada remota.

Nenhum EXECUTE é concedido. Revisar ordem de locks, consistência e concorrência, autorização/revogação, múltiplas abas, RLS/FORCE, todos os escritores legados e comprovação de parada antes de habilitar. Não aplicar em produção nem disparar tarefa externa.
