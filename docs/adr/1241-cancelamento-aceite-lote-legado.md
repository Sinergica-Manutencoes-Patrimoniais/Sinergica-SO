# ADR-1241 — Cancelamento de aceite de lote de rascunhos

## Decisão

Preparar cancelamento auditado e imutável de aceite ainda não executado, por ator autorizado, com motivo e requestId. Cancelamento e criação compartilham trava por aceite; uma criação já concluída impede cancelamento e um cancelamento concluído impede nova criação. Repetição com os mesmos dados devolve o recibo original. O aceite e a seleção permanecem preservados.

## Limites

Cancelamento não reverte um lote já criado, não exclui Planos e não prova ausência de chamada em andamento antes da aquisição das travas. Gate fechado e função privada até interface, testes, revisão de autorização/RLS, ordem de locks, concorrência nas duas ordens, replay e revisão adversarial. Não executar migração real nem gerar tarefa Auvo.
