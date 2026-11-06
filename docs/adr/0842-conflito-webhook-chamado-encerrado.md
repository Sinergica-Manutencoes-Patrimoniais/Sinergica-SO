---
name: "docs-adr-0842-conflito-webhook-chamado-encerrado-md"
description: "Documento Sinérgica SO: ADR-0842 — Conflito de webhook em Chamado encerrado"
alwaysApply: false
---

# ADR-0842 — Conflito de webhook em Chamado encerrado

Estado: proposta local; não homologada, gate privado fechado. Complementa ADR-0840 e ADR-0162.

A guarda proposta na 1028 pode rejeitar atualização de status vinda do webhook Auvo com `chamado_encerrado_requer_reabertura_formal`. O handler legado trata essa falha como erro inesperado e responde HTTP 500, sem deixá-la visível na reconciliação. O contrato de retry e o identificador de evento do Auvo não estão comprovados; não se pode afirmar entrega nem inventar identidade de evento.

Criar registro mínimo e privado de conflito ativo por OS, task e status remoto desejado, sem payload, dados pessoais ou credenciais. A RPC aceita apenas `service_role`, confirma o vínculo observado entre OS e task, verifica Chamado encerrado direto ou singular e grava com chave única por OS/task/status. Retransmissões enquanto o conflito estiver aberto retornam o mesmo registro; isso deduplica a condição, não prova que os eventos sejam idênticos. A fila existente de OS em reconciliação passa a classificar a OS com conflito aberto; acesso continua submetido ao gate e à autorização `integracao.reconciliar`. Nenhuma resolução automática é inferida e nenhuma ação remota é disparada.

A captura tem gate separado fechado por padrão. O webhook tenta registrar apenas para o código e mensagem exatos da guarda e preserva o HTTP 500 anterior, tanto se o registro funciona quanto se falha. Isso não pressupõe nem garante que o Auvo repetirá a entrega. Registro e atualização rejeitada não são atômicos: se a captura falhar ou o processo cair entre as chamadas, o conflito pode não estar registrado. Essa lacuna, a confirmação do contrato externo, resolução auditada, observabilidade, CI/db-tests, integração e revisão adversarial bloqueiam rollout; 1028 também permanece bloqueada. Rollback exige migration própria para desativar captura e referências, preservando os conflitos registrados.
