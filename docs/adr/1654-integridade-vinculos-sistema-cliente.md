---
name: "docs-adr-1654-integridade-vinculos-sistema-cliente-md"
description: "Documento Sinérgica SO: ADR-1654 — Integridade de Cliente em vínculos de Sistema"
alwaysApply: false
---

# ADR-1654 — Integridade de Cliente em vínculos de Sistema

## Estado

Proposta E01-S176, não aplicada nem homologada.

## Decisão

Acrescentar guards server-side obrigatórios para novos vínculos ou alterações efetivas de vínculo Sistema–item e para mudanças efetivas de Cliente dos registros vinculados. Ambos devem pertencer ao mesmo Cliente não nulo. Usar try-lock transacional comum seguido de travas de leitura em Sistema e item ao conferir um vínculo; contenda retorna erro de serialização recuperável. Proteção é integridade, não altera permissões ou política Auvo. O índice único existente permanece.

Vínculos legados não são alterados, removidos ou validados em lote. Leituras, exclusões de vínculo e atualizações que não alterem seus endpoints ou Cliente continuam disponíveis para diagnóstico e correção. Uma mudança que leve a novo vínculo inconsistente é rejeitada. Inventário de dados legados continua obrigatório antes de implantar.

## Limites

As mudanças que afetam vínculo ou Cliente exigem READ COMMITTED: em REPEATABLE READ ou SERIALIZABLE, uma trava consultiva não renova o snapshot e a verificação poderia não enxergar um vínculo confirmado anteriormente. Alterações de vínculo sem mudança efetiva e exclusões não recebem essa exigência. Essa restrição pode afetar escritores legados e deve ser inventariada antes de aplicar.

A trava cobre apenas caminhos participantes; operações que já bloqueiam linhas antes de entrar no trigger podem competir com outros protocolos, exigindo provas de concorrência e ordem de bloqueios com 1304/1305, escritores de serviço e alterações hierárquicas. `FOR SHARE` e try-lock não provam ausência de todos deadlocks no sistema. Apuração de vínculos inconsistentes, idempotência dos clientes, inventário/rollback e revisão adversarial precedem aplicação. Nenhum dado legado é apagado pela migration.
