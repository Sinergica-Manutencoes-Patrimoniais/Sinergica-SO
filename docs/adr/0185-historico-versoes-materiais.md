# ADR-0185 — Leitura temporal das versões de linhas de materiais

## Contexto

Eventos de disponibilidade e exceção incrementam a revisão da lista sem criar snapshot de linhas. Consultar somente snapshot de mesmo número pode falhar ou omitir a última organização válida.

## Decisão

Preparar consulta autorizada da última versão de linhas com revisão menor ou igual à revisão solicitada; sem versão, retorna null e mantém texto original. Outra consulta paginada lista apenas versões efetivamente criadas, com revisão, data e responsável. A UI distingue versão de linhas da revisão geral. RPCs revogadas até rollout, nenhuma compra, OS ou movimentação financeira.

## Limites

Exige revisão do snapshot atual, concorrência, autorização/revogação e segurança das linhas; não cobre anexos de campo nem eventos de disponibilidade/exceção em timeline única. Verificar no banco e integrar CI antes de ativar. Não aplicada nem testada.
