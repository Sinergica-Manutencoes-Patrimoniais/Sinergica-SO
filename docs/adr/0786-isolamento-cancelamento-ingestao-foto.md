# ADR 0786 — Isolamento da serialização do cancelamento de foto

O cancelamento de 0986 depende de nova leitura após obter o advisory lock. Em `REPEATABLE READ`, snapshot anterior pode não enxergar reserva confirmada durante a espera e registrar tombstone incompatível. O serviço de ingestão já rejeita isolamentos diferentes de `READ COMMITTED` na 0974; esta decisão aplica a mesma barreira ao cancelamento público e ao trigger de inserção de reserva. Isolamento não suportado falha fechado com `25001` antes de consultar ou modificar dados.

Não é alteração retroativa de dados nem libera gates. Validar concorrência em duas sessões para `READ COMMITTED` e recusa para `REPEATABLE READ`/`SERIALIZABLE`; testes de autorização e revisão adversarial continuam obrigatórios antes de ativar.
