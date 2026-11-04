# Contratos de comando — E01-S175

`ingerirTask(origem, taskId, eventoId|digest, sourceUpdatedAt, payload)` servidor autenticado por HMAC ou job interno; transação única e idempotente. `triagemCampo(chamadoId, ação, destinoChamadoId?, alterações?, motivo, expectedRevision, requestId)` aceita confirmar/corrigir/unir/duplicidade/cancelar, valida mesmo Cliente e permissão E01-S170. `receberLevantamento(taskId, questionnaireId, schemaVersion, respostas, fotos, sourceUpdatedAt)` entrega staging E01-S178 e retorna lote/pendências; não grava estrutura oficial.

## Regras comuns

Comandos de decisão recebem requestId UUID e expectedRevision; servidor deriva ator e permissões da sessão, nunca de campo fornecido pelo client. Mesma requestId com mesmo conteúdo retorna resultado anterior; conteúdo incompatível ou versão obsoleta gera 409. Entrada inválida 422, acesso negado 403, objeto inacessível 404 sem revelar outro Cliente; gate fechado 412 quando aplicável. Erro problem+json com reqId e sem stack/credencial. Nenhum comando client aceita service_role.

Efeitos externos pertencem ao fluxo dono do objeto e usam intenção persistida/reconciliação; não realizar escrita de rede dentro de lock DB. Resposta tardia precisa de versão/fencing válidos. HMAC é obrigatório para webhook, job interno tem autenticação servidor. Read models não entregam custos/segredos a usuário sem permissão. Contratos compartilhados: `docs/planejamento/plano-manutencao/contratos-programa.md`; ADR-0026/0027/0028. Sem API real ou deploy nesta especificação.
