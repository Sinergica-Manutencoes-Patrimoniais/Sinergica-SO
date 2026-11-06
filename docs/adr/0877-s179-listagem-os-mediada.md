---
name: "docs-adr-0877-s179-listagem-os-mediada-md"
description: "Documento Sinérgica SO: ADR 0877 — Mediação da listagem de materiais por OS"
alwaysApply: false
---

# ADR 0877 — Mediação da listagem de materiais por OS

## Contexto

PCM e Comercial consultam a função de 0322 por OS e Cliente. O núcleo está acessível diretamente e sua checagem de autorização não é serializada com revogação concorrente.

## Decisão

Introduzir leitura mediada com gate próprio fechado, sessão autenticada, READ COMMITTED, trava compartilhada de autorização e releitura do gate. Delegar filtros, paginação e validação Cliente/OS ao núcleo existente, que se torna privado. Atualizar consumidores PCM e Comercial em conjunto, sem fallback.

## Limites

A revogação de ACL quebra clientes antigos; exigir inventário e rollout coordenado antes de implantação. Gate não protege outras leituras ou escritas. Provas de concorrência, ACL/HTTP oficial, clientes antigos e revisão adversarial permanecem necessárias. Sem deploy ou Auvo.
