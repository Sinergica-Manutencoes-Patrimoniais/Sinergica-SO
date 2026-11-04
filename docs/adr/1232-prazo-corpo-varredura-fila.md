# ADR-1232 — Prazo de leitura da entrada periódica da fila

## Decisão

A entrada interna da varredura da fila limita também o tempo de leitura do corpo, além dos bytes. A expiração recusa a requisição antes da chamada ao banco e solicita cancelamento do stream, sem aguardar cancelamento cooperativo. Não altera o executor transacional nem habilita agendamento.

## Limites

O prazo não prova que a origem encerrou o transporte e não cobre autenticação, envio da resposta ou tempo de CPU do runtime. Testar stream lento, cancelamento, rejeição tardia, limites de bytes, autenticação e timeout da RPC no runtime efetivo. Flag, gates e homologação continuam fechados.
