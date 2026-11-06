---
name: "docs-adr-0173-vinculo-levantamento-cadastro-existente-md"
description: "Documento Sinérgica SO: ADR-0173 — Vínculo conservador de levantamento a cadastro existente"
alwaysApply: false
---

# ADR-0173 — Vínculo conservador de levantamento a cadastro existente

## Decisão

Preparar decisão de PCM que vincula uma linha de ativo a cadastro já existente do mesmo Cliente e tipo, sem alterá-lo ou criar registro duplicado. Exigir confirmação de revisão, existência ativa, Local compatível e código informado igual ao código atual quando houver. Referência de pai, se informada, deve estar previamente decidida e corresponder à posição/pai real. A decisão é transacional, auditada e idempotente, e compartilha a tabela de incorporações para impedir decisão dupla. Gate fechado e comando revogado.

## Limites

Não atualiza o cadastro nem resolve divergências, aliases, classificação/categoria, vínculos funcionais ou duplicidade sofisticada. Uma entidade só pode ser vinculada a uma linha na estrutura atual; isso é conservador e precisa revisão para lotes sucessivos. Nenhuma inferência de aprovação de códigos ou sync remoto. Não ativar sem validação de concorrência, semântica dos pais e revisão adversarial.
