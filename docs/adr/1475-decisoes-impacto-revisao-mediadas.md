---
name: "docs-adr-1475-decisoes-impacto-revisao-mediadas-md"
description: "Documento Sinérgica SO: ADR-1475 — Decisões de impacto de revisão mediadas"
alwaysApply: false
---

# ADR-1475 — Decisões de impacto de revisão mediadas

## Contexto
As telas S165 listam e registram decisões sobre ocorrências de calendário e Visita da S166, mas as quatro funções correspondentes foram tornadas privadas. Conceder acesso direto removeria a oportunidade de coordenar sessão, autorização e ativação com as demais operações mediadas.

## Decisão
Adicionar fronteira autenticada opt-in, inicialmente desativada, sobre as funções existentes. Verificar sessão, Cliente, permissão de gestão e, para Visita, permissão de confirmação; segurar gate e trava compartilhada de autorização durante a operação. Manter revisão, idempotência, auditoria e fotografias nas funções canônicas existentes. A leitura trava a linha do Plano para detectar revisão concorrente; a escrita deixa o núcleo adquirir suas próprias travas, inclusive para replay de comando anterior. Os quatro métodos não alteram Ocorrência ou OS e não autorizam aprovação de revisão. As telas preservam o mesmo requestId em falha ou sessão alterada.

## Limites
As fotografias são parciais; falta integrar todas as fontes, reconciliar geração e consumidores e comprovar concorrência com os escritores legados. Testar ordem de locks e revogação com os demais gates, replay, isolamento Cliente, integração de ambas as modalidades e realizar revisão adversarial antes de habilitar. A mudança não implementa aprovação nem libera deploy/Auvo.
