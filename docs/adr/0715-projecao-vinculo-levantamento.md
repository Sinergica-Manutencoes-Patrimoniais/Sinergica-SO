# ADR-0715 — Distinguir vínculo de incorporação

A decisão de vínculo da ADR-0173 não altera nome ou outros dados do cadastro existente e não exige nome igual. A projeção mediada distingue vínculo de criação somente quando o fato de incorporação referencia comando auditado `vincular_ativo`; preserva decisões e dados anteriores. Se não houver prova desse comando, não infere vínculo.

A alteração não aprova dados divergentes nem atualiza cadastro. Requer testes de histórico, acesso por Cliente, paginação dos consumidores e revisão antes da ativação.
