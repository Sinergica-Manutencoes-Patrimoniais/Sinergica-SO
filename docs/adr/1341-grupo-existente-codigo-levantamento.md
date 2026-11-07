---
name: "docs-adr-1341-grupo-existente-codigo-levantamento-md"
description: "Documento Sinérgica SO: ADR-1341 — Código de Grupo existente no levantamento"
alwaysApply: false
---

# ADR-1341 — Código de Grupo existente no levantamento

**Estado:** proposta; não aplicada nem homologada.

## Contexto

A aprovação parcial reserva códigos para novos cadastros. Quando a planilha informa código já registrado para um Grupo, a aprovação atual recusa o código antes de o PCM poder escolher o Grupo existente. A atualização de Grupo também rejeita o atributo de código, mesmo quando corresponde ao cadastro.

## Decisão

Permitir a aprovação sem nova reserva quando o código pertença a um único Grupo ativo do mesmo Cliente. Isso não incorpora a linha nem escolhe automaticamente o Grupo. A atualização ou o vínculo de Grupo existente só aceita código informado ou aprovado no staging quando corresponder exatamente a um código atual ou histórico do Grupo explicitamente escolhido. Não cria, substitui nem apaga código; divergência, outro Cliente e ambiguidade são recusados. Criação de Grupo novo permanece sujeita à reserva própria.

## Limites

As alterações dependem dos gates, autorização e versões exatas dos comandos existentes; a migration deve falhar se os trechos esperados não forem encontrados. Validar concorrência entre aprovação, atualização e substituição de código, unicidade global, reabertura e reserva, replay de pedidos antigos, permissões, RLS/FORCE e revisão adversarial antes de habilitar. Não reconcilia automaticamente dados históricos nem altera Grupos fora do comando autorizado.
