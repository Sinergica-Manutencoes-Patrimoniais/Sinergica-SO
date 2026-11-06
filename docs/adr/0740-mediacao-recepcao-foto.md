---
name: "docs-adr-0740-mediacao-recepcao-foto-md"
description: "Documento Sinérgica SO: ADR 0740 — Mediação e recuperação de vínculo já confirmado de foto"
alwaysApply: false
---

# ADR 0740 — Mediação e recuperação de vínculo já confirmado de foto

## Decisão

O vínculo de foto de levantamento passa por mediador autenticado sujeito aos gates de conferência e de fotos e à capacidade atual de aprovação no Cliente do lote. A função interna continua sem concessão direta; continua verificando propriedade do objeto, origem, requestId, lock e auditoria. A mediação não interpreta falha do Storage como sucesso nem altera objeto.

Uma consulta separada permite recuperar somente uma operação já registrada para o mesmo ator, lote, linha e caminho, após verificar novamente a capacidade atual. A resposta é um recibo histórico; ela não comprova identidade dos bytes nem disponibilidade presente do objeto. Não encontrar recibo mantém a tentativa pendente; não implica que o upload falhou. A consulta e a mediação não resolvem o caso de upload concluído sem vínculo confirmado, que permanece para reconciliação segura posterior.

## Limites

Não atribuir confiança ao hash do navegador como prova de integridade do Storage. Antes de ativar gates são necessários testes de RLS, isolamento entre Clientes, replay, revogação e concorrência, além de revisão de segurança. Não modificar arquivos existentes nem acionar Auvo ou publicar imagens.
