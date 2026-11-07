# Modelo de dados — E01-S168

Modelo lógico planejado; nomes físicos finais seguem `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028.

OS mantém UUID e auvo_task_id único, versão programação monotônica e validação separada. Intenção: os_id, visita_id, request_id único, versão, operação, eligible_at, estado, lease/fence, tentativa, erro e correlation_id; unicidade por OS/versão/operação e apenas cabeça executável. Estados: aguardando, elegível, processando, confirmado, falha conhecida, incerto, superado e cancelamento pendente de reconciliação. Inbox guarda chave/digest, taskId, versão/data de origem confiável, recebido_em e aplicação. Validação guarda ator, decisão, evidências e motivo append-only. Gate armazena capacidade, versão, ambiente e evidência. PMOC preserva schedule/record/PDF e chave de execução idempotente.

## Invariantes

RequestId único, expectedRevision obrigatório em decisão concorrente; UUID interno preservado. Referências devem pertencer ao mesmo Cliente. Tentativas/eventos/decisões conservam origem, ator, instante e resultado; histórico append-only. Payload minimizado e evidência privada com acesso por escopo. SQL novo será aditivo, RLS FORCE em todas as tabelas e testes permitido/negado. Não editar migrations aplicadas nem apagar dado para reconciliar conflito.
