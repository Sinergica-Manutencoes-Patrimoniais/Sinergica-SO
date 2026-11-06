---
name: "docs-adr-0832-autorizacao-criacao-os-chamado-md"
description: "Documento Sinérgica SO: ADR-0832 — Serialização da autorização de criação de OS do Chamado"
alwaysApply: false
---

# ADR-0832 — Serialização da autorização de criação de OS do Chamado

Estado: proposta local, não homologada. Complementa ADR-0107; não habilita criação múltipla.

O comando preparado `sso_criar_os_chamado` consulta autorização atual, mas não a serializa com alteração de concessões. Em duas sessões sintéticas com READ COMMITTED, uma mesma transação observou autorização verdadeira, uma revogação concorrente concluiu e a consulta seguinte retornou falsa. É demonstração da janela no mecanismo de autorização, não execução da função gateada nem prova de criação de OS. Uma autorização anterior poderia ficar obsoleta antes da escrita.

Após verificar gate e restrições legadas, o comando passa a exigir READ COMMITTED e tenta obter o lock compartilhado transacional usado por 0319 para fontes de autorização, antes de consultar concessões ou executar escrituras. Revogação em curso causa `55P03`; comando que obtiver o lock primeiro mantém sua autorização serializada até o fim da transação. O replay também é protegido. Mantêm-se gate fechado, bloqueio por índice e trigger legados, ausência de EXECUTE e o restante do contrato. Não há concessão de capacidade, criação de OS ou ativação de integração nesta alteração.

Essa medida não resolve concorrência com todas as alterações de Chamado/OS, transição 1:N, compatibilidade dos consumidores ou prova de criação efetiva. Testes com duas sessões, ordem inversa da revogação, retry, gate fechado e revisão adversarial são necessários antes de qualquer liberação. Rollback é substituição futura pelo corpo anterior, restaurando risco de revogação concorrente; não altera dados.
