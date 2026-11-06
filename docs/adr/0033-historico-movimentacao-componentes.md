---
name: "docs-adr-0033-historico-movimentacao-componentes-md"
description: "Documento Sinérgica SO: ADR-0033 — Histórico futuro da estrutura de Componentes"
alwaysApply: false
---

# ADR-0033 — Histórico futuro da estrutura de Componentes

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

## Decisão

Registrar em `audit.events` uma mudança efetiva de Cliente, Área, Local, pai, ativação ou exclusão lógica de `pcm.equipamentos`. O evento transacional guarda somente identificação e valores estruturais anteriores/posteriores, com ator da sessão quando disponível. Escritas diretas e processos legados também passam pelo trigger; nenhum evento é gerado quando esses valores não mudam. Rollback desfaz alteração e evento juntos. A estrutura existente e seus códigos permanecem inalterados.

## Limites e compatibilidade

Histórico começa na implantação e não inventa movimentos anteriores. Evento não substitui autorização por capacidade, revisão otimista ou comando idempotente; essas partes seguem pendentes. Chamadas de serviço sem usuário terão ator nulo e exigem rastreio de origem em integração futura. Retirada do trigger não remove eventos já registrados; rollback exige avaliação de auditoria. Em teste de concorrência com transações confirmadas, usar banco descartável ou aceitar eventos sintéticos append-only; não apagar eventos reais.
