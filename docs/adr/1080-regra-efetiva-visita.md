# ADR-1080 — Regra efetiva da Visita contratual

Status: proposta local, não aplicada nem homologada.

## Contexto

A origem da Visita é imutável e identifica a regra que a criou. Mudanças futuras do dia não podem editar essa origem nem apagar a regra anterior. Consultores que usam a origem diretamente continuariam enxergando a regra histórica mesmo após uma mudança efetiva.

## Decisão

Registrar, em histórico aditivo privado por Visita e revisão, a transição entre regra efetiva anterior e nova, com datas anterior e nova, comando e ator. A regra efetiva é a regra da transição mais recente ou, se não houver transição, a regra da origem. A tabela não altera a origem e não produz alteração de data ou tarefa externa. A escrita deverá ocorrer na mesma transação da mudança de regra e de Visita, com autorização, locks e auditoria; somente essa futura operação poderá usar o registro como parte da mudança.

## Limites

Este fundamento não altera a Visita e não resolve feriados, exceções, ocorrências ou autores de regra concorrentes. Antes de integração, inventariar e adaptar geradores e leitores que usam `regra_id` da origem; provar serialização, integridade de revisão, rollback, isolamento de Cliente, RLS do proprietário, referências, idempotência e revisão adversarial. Manter acesso privado e não ativar rollout antes do fluxo transacional completo.
