# ADR-0065 — Edição de dados operacionais de Visita não confirmada

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Em rascunho ou Visita planejada, comando transacional altera janela, fuso, posição, responsável e deslocamento. Requer autorização atual, revisão, requestId e validação de posição e responsável; registra antes/depois em auditoria. Identidade, Cliente, contrato, natureza, equipe e vínculos de OS não são alterados pelo comando. Retentativa idêntica retorna resultado original.

Visita confirmada ou posterior permanece protegida até existir invalidação de confirmação com coordenação segura das integrações. Edição não altera regra contratual, agenda legada ou Auvo; não prova disponibilidade/capacidade. Integração com geração contratual e política completa de permissões permanece gate.
