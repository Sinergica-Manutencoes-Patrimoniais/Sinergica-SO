---
name: tasks-E02-S09-agente-comercial-whatsapp
description: Decomposição e gates do agente comercial via WhatsApp.
alwaysApply: false
---

# Tasks — Agente comercial via WhatsApp

| # | Task | AC | Gate | Status |
|---|------|----|------|--------|
| 1 | Persistir persona e vínculo da instância | 1,2 | pgTAP multi-instância | done |
| 2 | Consumir fluxo/base/modelo/regras da persona | 2,3 | Deno check + unit | done |
| 3 | Criar lead, score e vínculos transversais | 4 | pgTAP relacionamento | done |
| 4 | Responder pela instância de origem | 5 | teste contrato Evolution | done |
| 5 | Aplicar handoff auditável | 6 | pgTAP handoff | done |
| 6 | Endurecer webhook contra abuso/reentrega | 7 | teste webhook + pgTAP | done |

## Definition of Done
- [x] Spec ↔ código rastreável.
- [x] Testes unitários e typecheck verdes.
- [x] pgTAP local em stack criada do zero + smoke SQL remoto verdes.
- [ ] UAT externo pós-merge com Evolution real — requer conectar a instância via QR Code.
- [x] Nenhuma `SPEC_DEVIATION` aberta.
