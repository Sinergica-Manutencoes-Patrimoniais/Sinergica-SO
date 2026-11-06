---
name: "docs-adr-1316-foto-verificada-grupo-md"
description: "Documento Sinérgica SO: ADR-1316 — Vínculo de foto verificada ao Grupo"
alwaysApply: false
---

# ADR-1316 — Vínculo de foto verificada ao Grupo

## Contexto

O caminho legado de fotos de Grupo rejeita fotos recebidas pela ingestão com
digest. Remover essa guarda faria o caminho antigo servir bytes sem conferência
do digest. O Grupo precisa de vínculo e leitura próprios para fotos verificadas.

## Decisão

Preparar vínculo separado, imutável e auditado, sob gate fechado. Exigir foto
confirmada com digest e objeto correspondente, decisão aceita atual, Grupo
ativo do mesmo Cliente e incorporação da linha no próprio Grupo. O request é
idempotente e não copia bytes. A retirada de foto vinculada por essa via é
bloqueada; futura desvinculação exige operação própria auditada.

Essa etapa não expõe fotos nem altera o vínculo legado. Leitura futura deve
conferir digest dos bytes e autorização atuais, sem caminho ao navegador.

## Antes de habilitar

Completar consulta, leitura segura e interface; validar locks, decisão
concorrente, retirada, reprocessamento, digest, Cliente, exclusão de Grupo,
RLS/FORCE, replay, migração e revisão adversarial.
