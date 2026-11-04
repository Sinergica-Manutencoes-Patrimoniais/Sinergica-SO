# ADR-0049 — Leitura histórica de Rotinas aprovadas

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

A projeção paginada de Rotinas preserva seu contrato. Versão em rascunho lê dados atuais; versão aprovada lê exclusivamente o snapshot congelado, inclusive nome do alvo, nome e referência do questionário e parâmetros da Rotina. A indicação de alvo ativo descreve a situação na aprovação, não a situação atual. Se uma versão marcada aprovada não possui snapshot íntegro, a leitura falha explicitamente, sem substituir história por dados atuais. Autorizações e isolamento do Cliente permanecem obrigatórios. A leitura de conteúdo completo de questionário para execução ainda precisa de contrato próprio antes da integração operacional.
