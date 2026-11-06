---
name: "docs-adr-0839-encerramento-chamado-vinculos-legados-md"
description: "Documento Sinérgica SO: ADR-0839 — Encerramento explícito com vínculos legados"
alwaysApply: false
---

# ADR-0839 — Encerramento explícito com vínculos legados

Estado: proposta local, não homologada; gates e ACLs permanecem fechados. Complementa ADR-0834 e ADR-0838.

O encerramento conferido 0611 e o comando interno 0333 examinavam apenas OS com `chamado_id` direto. Teste isolado reproduziu encerramento indevido de Chamado com escopo declarado atendido e OS singular unilateral ainda em execução. Essa ocorrência é incompatível com encerramento integral.

Os dois comandos passam a bloquear e examinar a união das OS diretas e da referência singular unilateral, sem duplicação; rejeitam referências divergentes ou compartilhadas pelo resolvedor privado da 1026. O comando conferido também reconhece OS unilateral finalizada nas parcelas e continuações. Mantêm identificação, histórico, auditoria, controle de revisão, requestId, gate, ACL e exigência de encerramento explícito. Antes de verificar autorização e fazer alterações, ambos exigem READ COMMITTED e lock de autorização compartilhado, usando o mesmo mecanismo de 0319/1020; revogação em andamento retorna `55P03`.

O teste de efeitos utiliza cópias temporárias das funções, neutralizando as verificações de gate somente nessas cópias; alterações, auditoria e fixtures são revertidas. Não prova que todos os escritores legados obedecem à ordem de locks nem autoriza liberação: criação 1:N, reconciliação, múltiplas sessões, CI e revisão adversarial ainda são requisitos separados. Rollback funcional requer migração posterior restaurando funções anteriores, reabrindo o risco de omissão sem apagar dados.
