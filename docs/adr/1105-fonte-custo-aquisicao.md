# ADR-1105 — Fonte explícita de custo de aquisição

Status: proposta local, não aplicada nem homologada.

## Contexto

A composição atual aceita parcelas de despesa de Visita, mas não há objeto de custo de aquisição com identidade própria comprovada. Descrição ou valor iguais não identificam um mesmo gasto. Material e retirada exclusiva não devem ser automaticamente tratados como despesa compartilhada da Visita.

## Decisão

Preparar registro imutável de fonte declarada de aquisição ligado à lista de materiais e à OS do mesmo Cliente, distinguindo material e retirada exclusiva. O registro tem UUID próprio, valor em centavos, revisão da lista, ator e requestId; não afirma pagamento, não gera despesa de Visita, pedido de compra, proposta ou faturável. Operador deve declarar a fonte; não inferir identidade por texto, valor ou data. Alterações futuras exigirão protocolo versionado, sem editar o registro.

## Limites

Um UUID não impede que duas declarações diferentes representem o mesmo gasto físico. Requer procedimento de conferência, vínculo a comprovantes/origens existentes quando houver, revisões, integração transacional à composição e exclusividade entre todos os consumidores. Gates fechados e sem concessão operacional até testar autorização, Cliente, idempotência, concorrência, privacidade, RLS/FORCE e revisão adversarial.
