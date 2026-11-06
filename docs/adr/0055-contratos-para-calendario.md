# ADR-0055 — Seleção mínima de contratos para calendário

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

O gestor autorizado consulta contratos do Cliente selecionado em projeção paginada no servidor, com ID, tipo, estado e vigência. A projeção não expõe valores, custo, escopo comercial livre ou outros dados de proposta. Não depende de concessão adicional de leitura comercial e não permite consultar outro Cliente; capacidade `plano.gerir` é verificada na sessão atual. A consulta não altera contrato nem implica ativação de Visita ou calendário.
