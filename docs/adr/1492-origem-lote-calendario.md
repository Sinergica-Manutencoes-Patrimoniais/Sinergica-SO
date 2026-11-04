# ADR-1492 — Conferência de origem na geração em lote

## Contexto
A preparação individual consulta origem, mas o lote ainda podia apresentar uma confirmação genérica mesmo com ciclo PMOC ou vínculo conflitante.

## Decisão
Preparar consulta limitada a 31 ciclos, que apresenta a origem de cada vencimento no mesmo contexto de Plano e versão. Com gate de lote habilitado, o gerador reavalia cada ciclo na própria transação e exige origem Plano; qualquer ciclo pendente, PMOC ou conflitante reverte o lote inteiro. Replays já confirmados mantêm o recibo. Interface sob flag não oferece lote novo enquanto houver item não elegível; tentativa anterior permanece repetível.

## Limites
A consulta só conhece vínculos PMOC explicitamente registrados e não prova exclusividade global. Gate é opt-in e exige gates da origem/PMOC e protocolo de concorrência existentes; medir carga e testar concorrência, replay e janela antes de ativar. Não altera PMOC, OS ou Auvo.
