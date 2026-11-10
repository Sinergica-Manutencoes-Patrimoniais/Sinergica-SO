---
name: "docs-adr-0979-seletor-os-ciclo-posterior-md"
description: "Documento Sinérgica SO: ADR-0979 — Seleção de OS para ciclo posterior"
alwaysApply: false
---

# ADR-0979 — Seleção de OS para ciclo posterior

Status: preparação privada, não homologada.

Preparar consulta de OS do mesmo Cliente e Chamado para parcela de ciclo posterior ativo. Na atribuição, mostrar somente OS não terminais quando não houver atribuição; na interrupção, mostrar somente a OS efetivamente atribuída com suspensão declarada, revisões e estado da declaração. Não criar OS, disparar tarefa, provar parada nem substituir a validação no comando.

Consulta, gates e EXECUTE permanecem fechados. Revisar paginação, Cliente, fontes de autorização, escopo, locks, RLS/FORCE e compatibilidade com os escritores antes de integrar/ativar. Testes e revisão adversarial continuam obrigatórios; sem alteração em produção.
