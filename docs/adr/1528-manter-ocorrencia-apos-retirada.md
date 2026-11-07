---
name: "docs-adr-1528-manter-ocorrencia-apos-retirada-md"
description: "Documento Sinérgica SO: ADR-1528 — Preservar ocorrência explicitamente mantida após retirada de escopo"
alwaysApply: false
---

# ADR-1528 — Preservar ocorrência explicitamente mantida após retirada de escopo

## Contexto
O PCM pode decidir `manter_sem_alterar` para uma ocorrência já existente enquanto a Rotina/alvo é retirada do rascunho. Após aprovação, um selo imutável identifica a ocorrência preservada, mas a guarda da fila e das pontes exigia que a mesma Rotina/alvo ainda constasse do novo snapshot, impedindo executar a decisão aprovada.

## Decisão
Ao tratar a ocorrência já identificada, quando não existir Rotina equivalente no snapshot da versão vigente, aceitar exclusivamente selo de continuidade para essa mesma ocorrência, Plano, Cliente e versão aprovada, vinculado à decisão `manter_sem_alterar` e à vigência. Aplicar somente aos consumidores que já conferem a guarda de continuidade: vínculo/materialização legada, fila e Chamado. Ausência, ambiguidade, selo divergente ou data fora da vigência permanecem recusadas.

## Consequências
Não se cria autorização para gerar novos ciclos em escopo retirado, nem se altera ocorrência, OS ou histórico. A regra não define o tratamento de datas distintas em mudança de âncora. Gate de continuidade e guarda 1045 permanecem; validar ciclos múltiplos, datas, concorrência e consumidores antes de liberar aprovação.
