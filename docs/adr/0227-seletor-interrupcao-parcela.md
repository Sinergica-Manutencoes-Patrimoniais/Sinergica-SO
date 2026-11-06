# ADR-0227 — Seleção de OS para declaração de interrupção

## Decisão

Preparar consulta paginada de OS reais do Chamado/Cliente da parcela vinculada, com revisões de escopo, suspensão e declaração já existente. O comando de declaração continua responsável por revalidar sob lock; a tela distingue declaração de prova de parada e não autoriza devolução.

## Limites

OS do Chamado não prova atribuição da parcela àquela OS. A consulta não expõe payload nem chama Auvo. RPC revogada/gate fechado; autenticação, isolamento, concorrência e semântica operacional dependem de testes e revisão.
