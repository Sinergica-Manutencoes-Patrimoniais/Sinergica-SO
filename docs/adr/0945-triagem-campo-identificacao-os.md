---
name: "docs-adr-0945-triagem-campo-identificacao-os-md"
description: "Documento Sinérgica SO: ADR-0945 — Identificação legível de OS na triagem de campo"
alwaysApply: false
---

# ADR-0945 — Identificação legível de OS na triagem de campo

Status: preparação local, não homologada.

## Decisão

Acrescentar consulta paginada para as mesmas OS elegíveis da triagem existente, incluindo número e título. Exigir autenticação, triagem global e capacidade `integracao.reconciliar` no Cliente indicado, gate próprio fechado e trava compartilhada de autorização. Uma correspondência significa apenas vínculo de Cliente e tarefa, não autenticidade ou aplicação do evento. A consulta anterior permanece inalterada.

## Validação necessária

Conferir RLS e permissões efetivas, fonte de autorização, revogação concorrente, ordenação, duplicidade, dados legados e divulgação de título antes de habilitar. Nome e título podem conter informação operacional; não retornar payload Auvo ou custos. A flag e gate permanecem fechados até revisão adversarial e testes integrados. Nenhuma OS é criada ou alterada.
