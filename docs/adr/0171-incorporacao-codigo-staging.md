---
name: "docs-adr-0171-incorporacao-codigo-staging-md"
description: "Documento Sinérgica SO: ADR-0171 — Código provisório na incorporação de ativo"
alwaysApply: false
---

# ADR-0171 — Código provisório na incorporação de ativo

## Decisão

Preparar wrapper transacional de incorporação que bloqueia o lote, confere a revisão do código provisório e incorpora o valor conferido quando existir; sem candidato usa somente o código informado explicitamente no pedido, sem gerar nem atribuir valor por inferência. A checagem e inserção oficial ocorrem na mesma transação com o comando 0359. A leitura de conferência exige capacidade de aprovação. Persistem gate fechado e funções revogadas.

## Limites

O candidato não é reserva e 0359 continua verificando formato, conflitos e compatibilidade com código da fonte. Não altera Grupo Quantitativo. Escritores legados, efeitos de triggers Auvo, duplicidade, concorrência e integridade dos vínculos devem ser validados antes de qualquer ativação. Migration e UI não testadas.
