---
name: "docs-adr-0881-s171-triagem-intencao-mediada-md"
description: "Documento Sinérgica SO: ADR-0881 — Triagem e histórico mediados de intenção de OS"
alwaysApply: false
---

# ADR-0881 — Triagem e histórico mediados de intenção de OS

Data: 2026-10-30 · Status: proposta, não implantada

## Contexto

O núcleo 0439 registra declaração humana ou descarte de intenção, e 0442 expõe histórico mínimo. Ambos exigem `visita.confirmar` e `integracao.reconciliar` e são privados; a tela não possui acesso autenticado.

## Decisão

Criar mediadoras para triagem, listagem das intenções e histórico, reutilizando a guarda de 1065 com gate fechado, READ COMMITTED e trava de autorização. Os núcleos privados continuam validando ambas as capacidades, Cliente, revisão, requestId e regras de negócio. Projeção de histórico continua sem motivo, referência ou texto livre. Corrigir referências ambíguas ao gate nas duas listagens privadas, sem ampliar sua ACL.

Nenhuma anotação comprova conciliação, altera vínculo ou tarefa Auvo. Antes de abrir o gate faltam validação de concorrência e todas as fontes de autorização, jornadas com ACL/HTTP oficiais, integração de conciliação efetiva e revisão adversarial. Frontend e banco precisam rollout coordenado; não implantar nesta etapa.
