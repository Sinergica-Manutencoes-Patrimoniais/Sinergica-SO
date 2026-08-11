---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Relatório de Inspeção: item vira Chamado pendente

> Tier pequeno. Reusa `derivarItemParaChamado` (já genérica, E01-S90) — só liga UI por item.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | UI: ação "Abrir chamado" no `ItemInspecaoCard` (visível só com `temEscrita` e `item.destino === null`) | AC-1,AC-5 | typecheck | done |
| 2 | UI: confirmação + handler chamando `derivarItemParaChamado` (gateways já existentes na página), recarrega itens após sucesso | AC-2,AC-3 | typecheck | done |
| 3 | UI: selo "Chamado aberto" quando `item.destino === "chamado"` | AC-3 | typecheck | done |
| 4 | Tratamento de erro reusando `erroAcao` | AC-4 | typecheck | done |

## Plano de teste
- Aceite manual (dev server): abrir uma inspeção concluída (ex. INSP-0027), abrir Chamado num item
  "Não conforme", conferir selo no item e o Chamado aparecendo em Chamados/OS → Solicitação.
- Sem teste de domínio novo (função reusada sem mudança de assinatura).

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] typecheck local verde
- [ ] ROADMAP.md + STATE.md atualizados
