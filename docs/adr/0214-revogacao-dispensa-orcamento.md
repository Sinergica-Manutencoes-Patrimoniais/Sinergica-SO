# ADR-0214 — Histórico e revogação de dispensa

**Estado:** proposta preparatória, sem homologação nem implantação.

A dispensa permanece imutável. Sua revogação é evento separado, com motivo, responsável, data e pedido idempotente; o operador precisa da capacidade individual de dispensa e revisão atual da lista. Somente uma dispensa vigente por lista é permitida. Após revogar, nova declaração pode ser registrada com identidade e justificativa próprias; a revisão da lista é verificada novamente. Decisões e revogações anteriores continuam consultáveis.

Nenhuma transição altera proposta, item faturável, OS, cobrança ou lançamento. Gate continua fechado e RPCs revogadas. A validade da regra contratual permanece conferência humana, não comprovação automática. Antes de liberar, testar competição entre declaração/revogação e mudança da lista, autorizações, concorrência, idempotência, paginação do histórico e integrações que venham consumir a dispensa; concluir revisão adversarial.
