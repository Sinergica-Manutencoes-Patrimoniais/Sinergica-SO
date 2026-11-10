---
name: "docs-adr-0149-composicao-backlog-pendencias-md"
description: "Documento Sinérgica SO: ADR-0149 — Composição privada de Backlog por Pendências"
alwaysApply: false
---

# ADR-0149 — Composição privada de Backlog por Pendências

## Contexto

O Backlog legado usa OS e não representa um agrupamento anterior à execução. S174 exige composição selecionada sem Chamado ou OS, preservando fontes e evitando dupla alocação.

## Decisão

Preparar agregado aditivo de composição com relações privadas para as Pendências de S173. O comando exige capacidade atual no Cliente, seleção única com revisões, estado aberto e mesmo alvo, bloqueia linhas em ordem determinística e recusa a parcela já vinculada. Um requestId repetido devolve o resultado original e não produz efeito externo. Uma constraint única impede duas composições para a mesma pendência enquanto não houver política segura de liberação. Não cria Chamado ou OS.

## Limites

É fundação fechada e não substitui a fila legada: GUTD, ranking unificado, liberação/retorno de parcela e promoção ao Chamado ainda não foram implementados. A unicidade é conservadora e impede também realocação; não ativar sem evolução transacional, conciliação legada, governança da capacidade e testes/revisão. Permissão `execucao.validar` é provisória. Não aplicar ou conceder funções isoladamente.
