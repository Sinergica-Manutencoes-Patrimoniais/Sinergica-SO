# ADR 1353 — Transição coordenada das restrições Chamado/OS

## Contexto

Os comandos 1:N, a guarda de escritores e a função de numeração não funcionam em conjunto enquanto o índice e a trigger legados estiverem instalados. Trocar somente uma das restrições pode permitir vínculos incompletos ou colidir números.

## Decisão

Preparar roteiros manuais transacionais de avanço e reversão, fora das migrations automáticas. O avanço exige exclusividade nas tabelas, gate de criação fechado, guarda instalada, trigger e índice legados identificados, vínculos consistentes e ausência de referências singulares ambíguas. Em uma transação instala a numeração compatível, ativa a guarda e retira somente as duas restrições legadas especificadas. Não abre o gate de criação nem envia tarefas.

A reversão exige gate de criação fechado e somente reconstrói o índice legado se não houver múltiplas OS ativas por Chamado; caso contrário falha sem modificar dados. Ela não exclui nem renumera OS. Ambos exigem suspensão prévia dos produtores e aprovação operacional após testes integrados e revisão adversarial.

## Consequências

Os roteiros não foram executados ou homologados. Verificar definições reais e histórico antes da execução; o inventário de relações externas e leituras singulares é pré-requisito não demonstrado pelo SQL. Exclusão lógica, solicitações em voo, efeitos externos e compatibilidade dos demais escritores exigem validação específica.
