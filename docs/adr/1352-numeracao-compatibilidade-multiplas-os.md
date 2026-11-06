---
name: "docs-adr-1352-numeracao-compatibilidade-multiplas-os-md"
description: "Documento Sinérgica SO: ADR 1352 — Numeração compatível na transição de Chamado para múltiplas OS"
alwaysApply: false
---

# ADR 1352 — Numeração compatível na transição de Chamado para múltiplas OS

## Contexto

A trigger legada sobrescreve o número de toda nova OS com o número do Chamado. Isso conflita com a unicidade de número quando há mais de uma OS, mesmo que a guarda de escritores esteja preparada.

## Decisão

Preparar função substituta de trigger, ainda não instalada. Ela preserva o comportamento legado para os demais escritores e o placeholder de backlog. Para a criação transacional S167 comprovada por token interno, utiliza número do Chamado acrescido do UUID da OS, igual ao definido no comando S167. Não altera números existentes. A instalação da trigger substituta, remoção das restrições antigas e abertura dos gates ocorrerão apenas em transição coordenada após as verificações necessárias.

## Consequências

A função não ativa a transição. Validar colisões, limites de coluna, compatibilidade de consumidores, produtores Auvo/Portal, histórico, concorrência, permissões, ativação e reversão. A reversão não pode restaurar o índice único após existirem múltiplas OS sem plano de tratamento; não apagar ou renumerar dados para viabilizá-la.
