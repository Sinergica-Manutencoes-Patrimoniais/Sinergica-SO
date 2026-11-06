# ADR-0243 — Reabertura auditada da conferência de lote

## Decisão

Preparar reabertura explícita e versionada de lote previamente conferido, com motivo, ator, revisão otimista e auditoria. Reabertura cria novo ciclo e preserva conferências e aprovações anteriores; exige nova conferência das linhas no ciclo atual e nova aprovação. Não reverte cadastros e recusa reabertura se houver qualquer incorporação/vínculo registrado no lote. Candidate code volta a ser editável antes de nova conferência. Gate e RPCs fechados.

## Limites

Rejeições anteriores permanecem e não são reabertas. Antes da ativação validar todos os escritores, lock de lote, autorização, integridade e interações com 0466; aprovação é declaração do PCM, não prova automática. Nenhuma migration aplicada ou teste executado.
