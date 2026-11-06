---
name: "docs-adr-0410-guarda-pesos-gutd-md"
description: "Documento Sinérgica SO: ADR-0410 — Guarda transversal de pesos GUTD"
alwaysApply: false
---

# ADR-0410 — Guarda transversal de pesos GUTD

Prepara-se proteção opcional para bloquear inclusão, exclusão e alteração de pesos fora do comando auditado, usando autorização privada transacional consumida na atualização. Alterações de outros campos não são bloqueadas. O gate nasce desligado e preserva o comportamento legado existente.

A ativação requer migração coordenada da interface legada, revisão dos papéis e consumidores, testes de rollback/concorrência e revisão adversarial. O comando auditado e o gate devem ser habilitados juntos; não se alteram pesos automaticamente.
