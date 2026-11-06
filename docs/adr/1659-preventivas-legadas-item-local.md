---
name: "docs-adr-1659-preventivas-legadas-item-local-md"
description: "Documento Sinérgica SO: ADR-1659 — Preventivas legadas por item no Local"
alwaysApply: false
---

# ADR-1659 — Preventivas legadas por item no Local

## Estado

Proposta E01-S176; não aplicada nem homologada.

## Decisão

Preparar leitura paginada de `pcm.planos_preventivos` por item e Local, separada dos Planos SSO novos. A função usa SECURITY INVOKER e preserva grants e RLS existentes, exige ator/Cliente/Local/item, autorização atual de cadastro e trava compartilhada 0319, além do gate privado fechado de leitura 1794. O SELECT filtra Cliente, Local e item na mesma instrução. O resultado informa nome, estado e recorrência registrados; não projeta vencimentos ou status de execução.

## Limites

A lista é restrita a dados visíveis pela RLS e não inclui Planos novos, ocorrências ou histórico de item sem vínculo direto. Páginas não formam um snapshot único. O gate 1794 é consultado sem bloqueio de sua linha, e o protocolo de autorização depende dos escritores aderirem à 0319. Validar grants/RLS reais, acesso a dois Clientes, concorrência, índices e revisão adversarial antes da ativação.
