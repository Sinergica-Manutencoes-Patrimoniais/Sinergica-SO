---
name: "docs-adr-0422-diagnostico-rollout-auvo-composicao-md"
description: "Documento Sinérgica SO: ADR-0422 — diagnóstico de rollout de composição e Auvo"
alwaysApply: false
---

# ADR-0422 — diagnóstico de rollout de composição e Auvo

Status: diagnóstico estático, não aplicado nem homologado. Não altera outbox, cron, gatilhos nem funções externas.

## Fluxos encontrados

- `0031` instala gatilho AFTER INSERT/UPDATE/DELETE em funcionários para `pcm.fn_auvo_enqueue('funcionarios')`. `0051` redefine a função para inserir na outbox e tentar chamar `pcm-auvo-push` via pg_net; o agendamento de drenagem é tratado no projeto independentemente da tentativa imediata. Um UPDATE que não altere status também pode enfileirar, salvo condições da função vigente. O adaptador de funcionários altera diretamente os registros e na desativação marca `ativo=false`, `deleted_at` e `auvo_sync_status=pending`; criar funcionário chama Edge Function explicitamente.
- `0011` criou disparo de tarefa ao transitar OS a planejamento, mas `0168` remove esse gatilho em favor de abertura sob demanda. Portanto não se deve concluir pelo arquivo 0011 isolado que a transição ainda dispara tarefa. `0169` implementa reserva de abertura e o caminho de abertura deve ser examinado integralmente antes de ativar qualquer integração.
- `0077` reconcilia tarefas excluídas no Auvo alterando status local de OS; `0072` enriquece OS importadas; `0026` descreve flag transacional para evitar reenfileiramento inbound. A flag não é autorização para suprimir eventos ou efeitos neste rollout.
- `0642` rejeita alterações de status/exclusão de fonte vinculada com gate de composição ativo. Isso pode impedir atualizações recebidas do Auvo e desativação operacional, exigindo tratamento explícito de falhas e reconciliação; ela não deve ser ativada em produção sem desenho aprovado.

## Condições para rollout

Inventariar estado real de gatilhos, grants, cron, funções, consumidores e filas no ambiente por consulta somente leitura; o histórico de migrations não comprova o estado implantado. Validar escritores diretos e de integração, autorização, ordenação, concorrência e efeitos de rollback em ambiente isolado sem dados reais ou conexão Auvo. Planejar janela de drenagem de transações, observabilidade, reconciliação humana e reversão que preserve eventos existentes. A guarda 0632 e os gates de composição continuam fechados até revisão adversarial e testes completos. Não ativar flags, processar filas nem criar tarefas reais nesta etapa.

A migration 0648 prepara uma consulta agregada por Visita autorizada, com gate e grants fechados. Ela conta estados locais de OS e itens pendentes/processando/em erro da fila dos funcionários vinculados, sem expor payload, erro, identificadores de fila ou dados de outros Clientes. Ausência de item pendente não prova sincronização nem estado remoto; funcionários compartilhados podem gerar contagens para mais de uma Visita. Permissão, isolamento e desempenho exigem revisão antes de habilitar.
