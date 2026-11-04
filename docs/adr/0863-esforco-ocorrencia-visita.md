# ADR 0863 — Esforço declarado para ocorrência por Visita

## Contexto

A fonte existente de esforço aceita OS e ocorrência por calendário. Ocorrências por Visita aparecem na consulta de capacidade, mas não podem receber declaração, embora representem demanda do mesmo domínio.

## Decisão

Ampliar a tabela append-only existente com referência opcional à ocorrência de Visita e manter exatamente uma origem por declaração. Criar mediadores específicos para Visita com os mesmos gates, controle de revisão, requestId, auditoria e autorização efetiva de capacidade e Plano. A projeção existente passa a buscar também a declaração da Visita. A declaração permanece incompleta e não prova execução, esforço restante ou saldo. Nenhum gate é ativado.

## Compatibilidade e limites

Registros e mediadores anteriores permanecem válidos. A substituição da constraint permite as mesmas linhas anteriores e a nova origem; o cliente antigo ignora a nova coluna. Novos clientes dependem da migration. Reversão após inserir declarações de Visita exige migração preservando essas linhas e histórico; não basta remover a coluna ou restaurar a constraint antiga. Avaliar locks de DDL, concorrência, riscos de autorização, bootstrap e revisão adversarial antes de deploy. Não implica homologação nem comprova reconciliação com OS.

A constraint ampliada é criada e validada antes de retirar a antiga, na mesma transação de migration. A troca e o `CREATE OR REPLACE` de projeção têm efeito imediato independentemente dos gates: DDL pode aguardar/bloquear escritores; a projeção existente muda para retornar esforço de Visita quando gates de consulta já estiverem ativos. O índice normal também pode bloquear escritas durante criação. Antes de aplicar, testar escritores antigos em concorrência e misturar versões de cliente; avaliar janela, tempo de validação e plano de rollback preservando as declarações já criadas. Os testes de fixture isolada não comprovam esses pontos.
