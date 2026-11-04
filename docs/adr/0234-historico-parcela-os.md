# ADR-0234 — Histórico de atribuição e declaração por parcela

## Decisão

Preparar consulta paginada, autorizada por Cliente, que reúne a atribuição explícita existente e os eventos imutáveis de declaração/revogação de interrupção, ordenados por data e requestId. Mostra ator, OS e motivo sem expor payload bruto. É histórico administrativo, não evidência de execução ou parada.

## Limites

Não permite devolução, realocação ou edição de eventos; não inventa origem de campo. RPC revogada e UI sob flag existente desligada, com testes e revisão pendentes.
