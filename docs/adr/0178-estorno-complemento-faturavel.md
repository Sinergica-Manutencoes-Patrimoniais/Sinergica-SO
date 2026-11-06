---
name: "docs-adr-0178-estorno-complemento-faturavel-md"
description: "Documento Sinérgica SO: ADR-0178 — Estorno lógico e complemento de faturável"
alwaysApply: false
---

# ADR-0178 — Estorno lógico e complemento de faturável

**Estado:** preparação fechada, sem homologação nem implantação.

Um complemento tem identidade explícita, origem e Cliente do item base, valor e motivo próprios; jamais substitui o valor do item anterior. Requisições repetidas recuperam o mesmo resultado. Estorno lógico integral referencia uma alocação existente, guarda motivo e autor, e recalcula saldos líquidos do item e documento; não exclui registro nem altera automaticamente o lançamento financeiro. Competência fechada impede essas operações.

O lançamento real permanece como estava: o estorno lógico não prova estorno contábil, não deve ser liberado nem refletido como conclusão financeira até existir reconciliação e fluxo coordenado do Financeiro. Gate e RPCs permanecem fechados. Revisar integridade dos saldos, duplicação, locks, restrições de lançamento e competência, autorização, correção de documento, integrações, histórico e concorrência antes de abrir; testar e executar revisão adversarial. Estorno parcial de uma única alocação não é suportado nesta fatia.
