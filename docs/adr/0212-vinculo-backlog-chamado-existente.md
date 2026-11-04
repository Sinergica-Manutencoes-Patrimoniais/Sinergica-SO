# ADR-0212 — Vínculo de composição a Chamado existente

## Decisão

Preparar vínculo transacional de uma composição de Backlog a Chamado existente no mesmo Cliente, com revisão de ambos e checagem das Pendências selecionadas, autorização de execução e gestão de escopo, retry e auditoria. O vínculo não cria Chamado, OS ou parcelas; as fontes continuam preservadas. Gate fechado e funções revogadas.

## Limites

Não equivale à promoção completa nem prova o restante: faltam mapeamento explícito de cada Pendência para parcela, execução/atendimento autoritativos, cancelamento e devolução parcial. O vínculo é único e conservador; não ativar sem conciliação de estados, locks e capacidade. Sem teste/aplicação.
