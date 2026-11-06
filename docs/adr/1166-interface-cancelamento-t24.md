# ADR-1166 — Conferência do cancelamento de candidata

Status: proposta local, não aplicada nem homologada.

Antes de pedir cancelamento local, a interface consulta estado e fence da candidata na mesma OS, Visita e Cliente, com autorização atual e gate de cancelamento fechado por padrão. O motivo e a revisão observada são guardados em pedido recuperável; a repetição não escolhe novo fence. Resposta de efeito iniciado informa incerteza, nunca cancelamento remoto. A concessão das funções não abre gate e não autoriza enviar ou cancelar tarefa Auvo.

Validar autorização, revogação, concorrência entre consulta e comando, replays, sessão, recuperação, privacidade do motivo, FORCE RLS e revisão adversarial antes da ativação.
