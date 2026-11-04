# ADR-0673 — Histórico preparatório de vínculo de parcela

Eventos imutáveis e revisionados registram origem, encerramento declarado e reentrada declarada para o vínculo existente Pendência–parcela, mantendo o ID e a PK do legado. O registro é autorizado, auditado e idempotente; não remove nem recria vínculos, não disponibiliza escopo para execução e não comprova ausência de trabalho em andamento.

O estado é estritamente declarativo e não altera a fila ou a regra de unicidade antiga. Para devolução efetiva ainda são necessários vínculo ativo versionado, adaptação de todos os consumidores, comprovação do trabalho e protocolo de concorrência, seguidos de testes e revisão adversarial. Gate fechado, sem concessões.
