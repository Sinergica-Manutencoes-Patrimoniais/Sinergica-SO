---
name: "docs-adr-1351-guarda-escritores-chamado-multiplas-os-md"
description: "Documento Sinérgica SO: ADR 1351 — Guarda de escritores durante a transição Chamado 1:N OS"
alwaysApply: false
---

# ADR 1351 — Guarda de escritores durante a transição Chamado 1:N OS

## Contexto

O índice legado impede qualquer segunda OS ativa por Chamado. Sua simples remoção permitiria que escritores antigos, que entendem uma OS existente como repetição, criassem vínculos adicionais sem idempotência. O comando S167 tem request, revisão, autorização e número independente, mas depende de transição coordenada.

## Decisão

Preparar uma guarda privada, inicialmente desligada, que serializa novos vínculos por Chamado. Escritores legados continuam podendo criar o primeiro vínculo, mas não adicionar outra OS ativa. Somente o comando transacional S167 coloca, durante a própria transação, um token interno limitado a ator, Chamado, Cliente e OS; a guarda exige esse token para uma segunda OS. O comando remove o token após o INSERT; rollback remove tudo em caso de erro. Alterações de campos sem mudança de vínculo ativo preservam comportamento.

Esta migration não remove o índice ou trigger de numeração legados, não abre gates e não libera 1:N. A adaptação do comando só é instalada se a definição esperada estiver presente. Com a guarda desligada, novos vínculos só passam se o índice legado ainda existir; sem ambos, falham fechados. Outros produtores com necessidade legítima de múltiplos vínculos permanecem bloqueados até adaptação explícita.

## Consequências

A guarda não resolve leitores singulares, numeração, referências legadas, ordenação de locks ou efeitos Auvo. Exige inventário dos produtores, adaptação coordenada, testes de duas sessões e transações (inclusive READ COMMITTED e isolamento maior), exclusão/restauração, transferência de Cliente, RLS/FORCE, permissão e revisão adversarial antes de abrir gate ou remover qualquer restrição. Nenhum código ou número existente é renumerado.
