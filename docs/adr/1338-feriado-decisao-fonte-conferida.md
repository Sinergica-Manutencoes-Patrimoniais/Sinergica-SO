---
name: "docs-adr-1338-feriado-decisao-fonte-conferida-md"
description: "Documento Sinérgica SO: ADR-1338 — Decisão de feriado com revisão conferida"
alwaysApply: false
---

# ADR-1338 — Decisão de feriado com revisão conferida

**Estado:** proposta; não aplicada nem homologada.

## Contexto

A interface mostra ao PCM uma declaração de feriado e sua revisão, mas o comando original aceita apenas seu identificador. A declaração pode ser alterada entre a conferência e a gravação, fazendo o comando registrar uma revisão que não foi revisada pelo usuário.

## Decisão

Preparar mediador que recebe revisão e data conferidas, bloqueia a linha de feriado durante a gravação e recusa divergência antes de chamar o comando existente. Retentativas com recibo existente passam pelo comando idempotente e verificam seu resultado, sem exigir que a declaração atual continue inalterada. Pedidos antigos preservados sem fotografia mantêm o protocolo anterior; não inferir o que foi conferido.

## Limites

O registro continua preliminar: não prova execução ou pendência operacional nem altera âncora ou cria OS. O mediador depende dos gates e autorização do comando interno. Antes da ativação, validar bloqueios concorrentes, ordem de travas, alterações/revogação, replay antigo e novo, RLS/FORCE, integração e revisão adversarial.
