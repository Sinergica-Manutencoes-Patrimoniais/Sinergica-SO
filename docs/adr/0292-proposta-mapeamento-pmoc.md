---
name: "docs-adr-0292-proposta-mapeamento-pmoc-md"
description: "Documento Sinérgica SO: ADR-0292 — Proposta humana de mapeamento PMOC"
alwaysApply: false
---

# ADR-0292 — Proposta humana de mapeamento PMOC

Status: proposta, não homologada.

Um operador autorizado pode registrar proposta imutável de associação entre agendamento PMOC, ciclo previsto e alvo do snapshot aprovado da Rotina. O agendamento deve pertencer ao mesmo Cliente e o ciclo existir na fonte; o alvo é copiado do snapshot, não escolhido por nome ou posição. A justificativa e o ator são auditados, porém a proposta não comprova equivalência de contrato, atividade ou alvo no PMOC. Não é vínculo validado, não ativa deduplicação e não altera geradores, agendamentos ou OS. Uma validação independente do PCM e evidência apropriada ainda precisam ser definidas e implementadas.

Gate de diagnóstico PMOC e EXECUTE permanecem fechados; revisão e testes obrigatórios antes da ativação. Desativação não remove histórico.
