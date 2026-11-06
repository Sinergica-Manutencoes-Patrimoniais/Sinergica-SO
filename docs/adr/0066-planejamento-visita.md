# ADR-0066 — Transição de rascunho para Visita planejada

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

O comando autorizado transforma rascunho em Visita planejada, mantendo identidade, conteúdo, vínculos e histórico. A transição não é confirmação e não atesta que equipe, responsável ou OS estejam completos. Usa revisão otimista, bloqueio da Visita, idempotência e auditoria transacionais. Não modifica agenda contratual ou legada e não envia nem enfileira Auvo. Confirmação posterior deve validar conteúdo atual e política de ciência no servidor.
