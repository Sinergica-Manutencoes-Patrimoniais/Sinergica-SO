---
name: "docs-adr-0487-reabertura-trava-reclassificacao-md"
description: "Documento Sinérgica SO: ADR-0487 — Reabertura e trava transversal de proposta"
alwaysApply: false
---

# ADR-0487 — Reabertura e trava transversal de proposta

Reabertura explícita usa comando versionado existente e preserva decisões e conferências. Revisão alterada torna registros anteriores obsoletos onde consumidores verificam revisão; não se afirma que todos os consumidores já estejam integrados. Enquanto houver qualquer proposta de reclassificação, guarda opt-in bloqueia nova aprovação de retorno, criação de Pendência a partir dele e registro de finalização de OS; inclusive proposta rejeitada bloqueia de forma conservadora. Operações antigas não são revertidas. Efetivação e reconciliação transversal permanecem bloqueadas; gate desligado, revisão adversarial e testes necessários.
