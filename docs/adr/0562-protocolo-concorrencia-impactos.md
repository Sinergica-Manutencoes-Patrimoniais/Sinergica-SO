---
name: "docs-adr-0562-protocolo-concorrencia-impactos-md"
description: "Documento Sinérgica SO: ADR-0562 — Protocolo opt-in e não bloqueante de concorrência"
alwaysApply: false
---

# ADR-0562 — Protocolo opt-in e não bloqueante de concorrência

Status: preparado, gate desligado, não aplicado nem homologado. Sob gate, triggers de statement dos escritores conhecidos de OS, ocorrências preparadas/legadas e pontes tentam a mesma trava transacional global sem esperar; conflito falha imediatamente e requer retry. 0785 exige esse gate/trava antes dos locks de linhas e usa NOWAIT. Com gate desligado os triggers não tomam trava e comportamento anterior é preservado.

Trava é global e pode causar contenção relevante entre Clientes; não habilitar sem janela de manutenção, inventário completo de escritores, estratégia de retry, teste de isolamento e revisão adversarial. Transações iniciadas antes da ativação, triggers desabilitados, fontes externas e tabelas não inventariadas permanecem risco. Não prova cobertura integral, não emite token e não libera aprovação 0715.
