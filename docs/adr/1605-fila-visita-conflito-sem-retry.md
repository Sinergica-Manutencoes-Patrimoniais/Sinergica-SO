---
name: "docs-adr-1605-fila-visita-conflito-sem-retry-md"
description: "Documento Sinérgica SO: ADR-1605: conflito definitivo da fila de Visita"
alwaysApply: false
---

# ADR-1605: conflito definitivo da fila de Visita

Cancelamento ou confirmação da fila de Visita com revisão ou estado divergente é rejeição definitiva do pedido. O SQLSTATE `40001` leva o PostgREST de ensaio a repetir a transação, mantendo a chamada pendente.

Os dois ramos de `fila_ou_revisao_indisponivel` passam a usar `P0012`. Demais erros, autorização, ordem de travas e replay permanecem intactos. A interface libera nova conferência somente quando recebe esse par de código e mensagem na primeira tentativa; replays e resultados incertos continuam preservados.

Consumidores externos que inspecionem `40001` para esse conflito devem reconhecer o par `P0012` e `fila_ou_revisao_indisponivel`. A decisão não autoriza ativação, deploy nem comunicação externa.
