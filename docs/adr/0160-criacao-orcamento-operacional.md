# ADR-0160 — Criação de proposta operacional em oportunidade existente

**Estado:** proposta preparatória, revogada e não homologada.

Quando existe oportunidade comercial legítima do mesmo Cliente, um operador autorizado pode escolhê-la explicitamente para criar um rascunho canônico e vinculá-lo à lista e à OS existentes, na mesma transação. Não se cria oportunidade fictícia, preço, cobrança, envio ou OS. Cada pedido tem identidade idempotente; o estado da lista é conferido por revisão e uma proposta operacional não cancelada já vinculada impede criação concorrente pela mesma lista. A composição segue no comando existente, depois da criação.

Sem oportunidade compatível, o fluxo retorna indisponível: origem operacional explícita sem oportunidade exige alteração coordenada do schema canônico e dos fluxos legados e não deve ser simulada. O comando e a consulta ficam revogados; interface fica em flag desligada. Antes de ativar: revisar bloqueios/concorrência com gravações legadas, permissão por Cliente, política de múltiplos orçamentos/complementos, recuperação de falhas, snapshot inicial, custos, RLS e revisar adversarialmente. Não declarar criação sem oportunidade implementada.
