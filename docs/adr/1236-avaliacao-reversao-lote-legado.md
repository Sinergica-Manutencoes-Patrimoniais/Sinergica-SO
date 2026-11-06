# ADR-1236 — Avaliação de reversão do lote de rascunhos

## Decisão

Preparar comando privado que avalia todos os rascunhos de um lote, com revisão e requestId individuais e motivo explícito. Reutiliza a reversão conservadora do ADR-1066 em ordem estável, numa única transação, registrando recibo imutável e contagens por resultado. A reexecução idêntica devolve o mesmo recibo. Erro de integridade reverte a transação; dependência encontrada é resultado de pendência, não exclusão.

## Limites

O gate individual de cobertura completa continua fechado: sem prova de dependências, cada item apenas registra pendência. Se esse gate vier a ser aberto após comprovação, alguns itens podem ser encerrados logicamente e outros permanecer pendentes; isso deve ser exibido explicitamente. Nada é apagado e não há reversão de ocorrências, OS ou financeiro. Função de lote e gate permanecem privados e fechados até revisão de isolamento, ordem de locks, replay, privilégios/RLS, dependências sem FK e testes integrados; não autoriza migração real.
