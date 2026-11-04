# Modelo de dados — E01-S175

Modelo lógico planejado; nomes físicos finais seguem `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028.

Inbox de origem: chave integração/taskId/evento, payload_ref, timestamp, estado aplicado/pendente/erro e razão. OS mantém UUID/taskId e dados de execução. Chamado acrescenta condição de triagem provisório/confirmado/unido/duplicidade/cancelado, origem, descrição original e destino opcional; histórico preserva referência anterior. Task possui uma OS local e criação transacional evita provisórios órfãos. Cliente desconhecido fica inbox pendente. Decisão triagem registra requestId, expectedRevision, ator, motivo e alterações por campo. Levantamento externo guarda schemaVersion, questionário, respostas estruturadas, fotos e stagingId.

## Invariantes

RequestId único, expectedRevision obrigatório em decisão concorrente; UUID interno preservado. Referências devem pertencer ao mesmo Cliente. Tentativas/eventos/decisões conservam origem, ator, instante e resultado; histórico append-only. Payload minimizado e evidência privada com acesso por escopo. SQL novo será aditivo, RLS FORCE em todas as tabelas e testes permitido/negado. Não editar migrations aplicadas nem apagar dado para reconciliar conflito.
