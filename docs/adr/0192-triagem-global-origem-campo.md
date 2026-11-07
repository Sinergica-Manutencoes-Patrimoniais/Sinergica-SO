---
name: "docs-adr-0192-triagem-global-origem-campo-md"
description: "Documento Sinérgica SO: ADR-0192 — Triagem global de origem de campo desconhecida"
alwaysApply: false
---

# ADR-0192 — Triagem global de origem de campo desconhecida

## Contexto

Um envelope sem Cliente confiável não pode ser listado sob o escopo de um Cliente arbitrário. O vínculo manual é declaração humana e não prova origem, autenticidade, OS ou aplicação do evento.

## Decisão

Preparar listagem mínima sem payload e comando de indicação manual de Cliente apenas para usuário ativo com concessão global explícita de `integracao.reconciliar` e módulo elegível. Comando exige também autorização atual para Cliente indicado, motivo, retry idempotente e auditoria; não altera envelope nem cria Chamado/OS ou chama Auvo. Triagem não substitui resolução automática nem trata o evento como confiável. Gate fechado e funções revogadas.

## Limites

Faltam autenticação de origem, integração de inbox e resolução operacional, revisão de visibilidade global e política de retificação de uma indicação. Não disponibilizar payload desconhecido ao navegador. Dados e permissões, concorrência e isolamento devem ser revisados e testados antes de ativação.
