# ADR-0035 — Integridade da posição física

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

Normalizar Local/Área antes de validar o pai do Componente, preservando derivação já existente do Cliente. Novas alterações de posição e Cliente são verificadas com bloqueio transacional dos registros de localização; alterações inversas de Cliente da Área ou da Área do Local não podem deixar Componentes ou Sistemas vinculados a outro Cliente. Grupo Quantitativo permanece protegido pela ADR-0032. Nenhum registro legado ou código é reescrito.

Mudança de Local entre Áreas do mesmo Cliente e atualização da Área redundante são tratadas na ADR-0036. Antes de homologar, testar propagação e concorrência real em banco descartável; não inferir correção de inconsistências legadas. Bloqueios podem gerar abortos por deadlock, mas não devem resultar em escrita parcial. A alteração não substitui capacidades, auditoria, revisão nem comando idempotente.
