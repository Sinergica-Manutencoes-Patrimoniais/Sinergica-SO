---
name: "docs-adr-1485-chamado-preventivo-revisao-md"
description: "Documento Sinérgica SO: ADR-1485 — Vigência antes de criar Chamado preventivo"
alwaysApply: false
---

# ADR-1485 — Vigência antes de criar Chamado preventivo

## Contexto
Um Chamado pode ser criado diretamente a partir do ciclo preparado, sem passar pela fila. Após revisão, isso poderia criar trabalho para escopo retirado mesmo com a fila protegida.

## Decisão
Com o protocolo de continuidade ligado, criar novo Chamado preventivo para calendário ou Visita exige a mesma verificação de versão vigente ou decisão selada da ADR-1483. Retorno de Chamado existente e replay preservam comportamento idempotente e histórico. O gate desligado mantém fluxo anterior.

## Limites
Não comprova outros consumidores nem efeitos de PMOC/legado. Testar concorrência de criação e revisão, três versões, cancelamento e preservação de Chamado/OS existentes, além de revisão adversarial antes de habilitar. Sem deploy ou Auvo.
