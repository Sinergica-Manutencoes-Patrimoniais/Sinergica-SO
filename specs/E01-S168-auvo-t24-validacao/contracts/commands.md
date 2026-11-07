# Contratos de comando — E01-S168

`confirmarVisita(visitaId, expectedRevision, requestId)` grava intenções sem rede. `processarElegiveis(limite)` é servidor-only e observa T−24/gate/fence. `reprogramarOs(osId, visitaDestinoId|null, motivo, expectedRevision, requestId)` mantém ID remoto. `cancelarOs(osId, motivo, expectedRevision, requestId)` invalida pendentes e concilia em curso. `receberEventoAuvo(rawBody, assinatura)` autentica e deduplica. `validarExecucao(osId, decisão, motivo, evidenciasConferidas, expectedRevision, requestId)` verifica obrigatórios/permissão e não encerra Chamado automaticamente.

## Regras comuns

Comandos de decisão recebem requestId UUID e expectedRevision; servidor deriva ator e permissões da sessão, nunca de campo fornecido pelo client. Mesma requestId com mesmo conteúdo retorna resultado anterior; conteúdo incompatível ou versão obsoleta gera 409. Entrada inválida 422, acesso negado 403, objeto inacessível 404 sem revelar outro Cliente; gate fechado 412 quando aplicável. Erro problem+json com reqId e sem stack/credencial. Nenhum comando client aceita service_role.

Efeitos externos pertencem ao fluxo dono do objeto e usam intenção persistida/reconciliação; não realizar escrita de rede dentro de lock DB. Resposta tardia precisa de versão/fencing válidos. HMAC é obrigatório para webhook, job interno tem autenticação servidor. Read models não entregam custos/segredos a usuário sem permissão. Contratos compartilhados: `docs/planejamento/plano-manutencao/contratos-programa.md`; ADR-0026/0027/0028. Sem API real ou deploy nesta especificação.
