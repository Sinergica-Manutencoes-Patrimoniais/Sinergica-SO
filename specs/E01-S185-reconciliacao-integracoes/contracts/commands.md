# Contratos de comando — E01-S185

`listarReconciliacao(filtros, cursor, limite)` retorna metadados permitidos e cursor, sem payload bruto. `solicitarRecuperacao(objeto, ocorrênciaId, ação, expectedRevision, requestId, motivo?)` valida permissão e delega ao fluxo proprietário; ações retry/consultar/confirmar vínculo/tratar conflito não implicam exclusão remota. `verificarPendencias(cursor, limite)` servidor-only classifica leases, ausência de webhook e falhas, atualizando mesma ocorrência. Resultado expõe estado, versão, correlationId e ação pendente; 409 em versão obsoleta.

## Regras comuns

Comandos de decisão recebem requestId UUID e expectedRevision; servidor deriva ator e permissões da sessão, nunca de campo fornecido pelo client. Mesma requestId com mesmo conteúdo retorna resultado anterior; conteúdo incompatível ou versão obsoleta gera 409. Entrada inválida 422, acesso negado 403, objeto inacessível 404 sem revelar outro Cliente; gate fechado 412 quando aplicável. Erro problem+json com reqId e sem stack/credencial. Nenhum comando client aceita service_role.

Efeitos externos pertencem ao fluxo dono do objeto e usam intenção persistida/reconciliação; não realizar escrita de rede dentro de lock DB. Resposta tardia precisa de versão/fencing válidos. HMAC é obrigatório para webhook, job interno tem autenticação servidor. Read models não entregam custos/segredos a usuário sem permissão. Contratos compartilhados: `docs/planejamento/plano-manutencao/contratos-programa.md`; ADR-0026/0027/0028. Sem API real ou deploy nesta especificação.
