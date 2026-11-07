---
name: "docs-adr-1292-vincular-localizacao-existente-levantamento-md"
description: "Documento Sinérgica SO: ADR 1292 — Vincular localização existente no levantamento"
alwaysApply: false
---

# ADR 1292 — Vincular localização existente no levantamento

## Contexto

O fluxo de levantamento pode criar uma localização ou atualizar o nome de uma existente. Falta vincular uma linha aprovada a Área, Local ou Sublocal já existente sem alterar esse cadastro, permitindo que linhas dependentes usem a mesma identidade.

## Decisão

Criar comando aditivo idempotente que reutiliza a trilha de incorporações e os gates de aprovação existentes. PCM informa explicitamente a localização e confirma a fotografia. Nome e hierarquia declarados devem coincidir; atributos não suportados não são descartados. O comando verifica Cliente, tipo, pai já vinculado, revisão, capacidade e aprovação, registrando vínculo e auditoria sem atualizar a localização. A projeção de decisão distingue vínculo de criação.

## Implantação e retorno

Gate próprio e flag de interface desligados. Não alterar cadastros legados ou códigos. Para retorno, fechar o gate após interromper a interface, preservando vínculos já registrados. Validar todos os consumidores de incorporações, triggers, concorrência, replay, pais, RLS/FORCE, privacidade e revisão adversarial antes de liberar; nenhum vínculo existente deve ser inferido por nome.
