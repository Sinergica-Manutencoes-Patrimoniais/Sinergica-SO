# ADR-1339 — Estado de ocorrência de calendário vinculada

**Estado:** proposta; não aplicada nem homologada.

## Contexto

Ocorrências preparadas não possuem estado de execução próprio. Parte delas tem vínculo verificável com ocorrência preventiva existente, que possui resultado e pode ter OS vinculadas. Tratar ausência de OS ou de vínculo como prova de pendência geraria informação falsa.

## Decisão

Preparar consulta por ocorrência de calendário e Cliente que verifica origem, data e alvo da ponte legada, retorna resultado preventivo e contagens de OS ativas e finalizadas e classifica somente o que essas fontes permitem. Uma ocorrência com resultado registrado é apresentada como tal; resultado pendente sem nenhuma OS histórica ou tarefa, com envio ainda previsto, é candidata aguardando; estado incompleto, vínculo divergente ou múltiplas OS permanece indeterminado. Grupo sem fonte equivalente também é indeterminado. A consulta não cria fila, OS, alteração de estado ou efeito Auvo.

## Limites

É uma leitura parcial, não prova ausência de execução externa ou completude de todos os vínculos. Pode mudar logo após a consulta. Antes de habilitar, verificar significado e histórico de `resultado_estado`, cancelamentos, exclusões, Cliente, concorrência, autorizações e cargas; testar isolamento e revisão adversarial. Falta ainda a fila operacional completa e integração das demais fontes.
