---
name: "docs-adr-1357-conferencia-itens-proposta-servico-md"
description: "Documento Sinérgica SO: ADR 1357 — Conferência de itens financeiros relacionados ao serviço"
alwaysApply: false
---

# ADR 1357 — Conferência de itens financeiros relacionados ao serviço

## Contexto

Uma proposta pode ter item integral ou faturáveis de material relacionados à mesma linha de um serviço declarado. O diagnóstico existente não apresenta quantos itens financeiros dessas origens estão vinculados à linha.

## Decisão

Adicionar consulta autorizada por Cliente e fato que conta itens base e complementos de proposta integral e materiais da mesma linha e versão, distinguindo cancelados e não cancelados. A consulta também devolve o número de declarações de material relacionadas, inclusive sem item faturável. Não soma valores, não decide exclusividade e não autoriza criação ou emissão. Resultados são fotografia pontual e podem mudar após a consulta.

## Consequências

Não cobre todas as fontes financeiras, despesas, histórico de alocação, estorno ou mesma execução identificada por outras linhas. Dados históricos cancelados permanecem visíveis. Exige validação de autorização, concorrência, RLS/FORCE, paginação de fontes e revisão adversarial antes de uso operacional.
