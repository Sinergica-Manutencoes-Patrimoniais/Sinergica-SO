# ADR-1082 — Base transacional da mudança do dia contratual

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar comando transacional próprio para versionar regra e mover Visitas regulares futuras, não confirmadas e sem alteração manual detectada, preservando IDs e origem. A operação exige revisão das Visitas informada pelo operador, serializa a série e cada Visita, usa a edição existente, registra mudança da regra efetiva e grava auditoria e recibo idempotente na mesma transação. Visitas confirmadas, reprogramadas, com horário divergente ou com OS sincronizada são preservadas.

## Limitação da primeira base

Não é a implementação completa de AC-3: Visitas afetadas com ocorrência preparada ou feriado na data de destino exigem processamento próprio e fazem o comando recusar integralmente, sem criar regra. O sistema ainda precisa implementar supressão e reconciliação desses casos, cobrir exceções e leitores legados e oferecer confirmação de fotografia completa na interface. Não habilitar antes de resolver essas lacunas, confirmar efeito de todos os triggers, autorização, concorrência, transações, dados legados e revisão adversarial. Nenhuma sincronização externa é autorizada.
