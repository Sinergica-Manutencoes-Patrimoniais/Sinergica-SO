# ADR-0143 — Consulta de decisão da linha de levantamento

## Contexto

As decisões finais de rejeição e incorporação são imutáveis e ficam em tabelas privadas distintas. A conferência já possui consulta separada para observações; a tela precisa apresentar a decisão efetiva sem presumir que todas as linhas do lote ainda estejam pendentes.

## Decisão

Preparar consulta pontual, por lote e chave de linha, que exige capacidade atual de aprovação no Cliente do lote e retorna somente a decisão registrada, incluindo revisão, data, responsável e motivo ou entidade incorporada. A consulta não altera estado e permanece revogada até revisão e rollout coordenado. A interface será protegida por flag desligada e exibirá erros explicitamente.

## Limites

Não substitui trilha completa de auditoria nem prova revogação em corrida. Rejeição e incorporação são decisões únicas no modelo atual; anotações de conferência continuam em consulta própria e podem ter paginação adicional. Não aplicar ou habilitar sem validar isolamento, contratos, concorrência e acesso com banco real.
