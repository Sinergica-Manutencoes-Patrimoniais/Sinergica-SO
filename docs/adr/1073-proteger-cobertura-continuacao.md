# ADR-1073 — Proteção da cobertura com continuidade

**Status:** preparação não homologada. Complementa ADR-1071.

Quando a proteção estiver habilitada, uma parcela com continuidades só pode passar a atendida por uma OS de continuidade vinculada e finalizada, com todas as continuidades vinculadas finalizadas e sem nova proposta pendente nas ordens da cadeia. A validação adicional não transforma status em prova de execução técnica; outras exigências de revisão permanecem aplicáveis. A criação de continuidade conferida depende deste gate para evitar ativar o novo fluxo sem a proteção.

O gate começa fechado. O trigger não altera parcelas já atendidas, não cobre referências fora das tabelas verificadas e não comprova a ausência de outros escritores ou corridas. Validar todas as transições, cadeias múltiplas, locks, reabertura, execução, concorrência e revisão adversarial antes de ativar; não tratar este gate como homologação de cobertura integral.
