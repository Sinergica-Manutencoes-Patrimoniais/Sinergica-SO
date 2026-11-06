---
name: "docs-adr-0311-vinculo-foto-staging-grupo-md"
description: "Documento Sinérgica SO: ADR-0311 — Vínculo explícito de foto do levantamento a Grupo"
alwaysApply: false
---

# ADR-0311 — Vínculo explícito de foto do levantamento a Grupo

O modelo de fotos de Grupo anterior exige objeto do bucket de Grupo e não aceita o bucket privado de levantamento. Em vez de duplicar bytes ou falsificar esse vínculo, prepara-se associação própria de proveniência ao Grupo incorporado pela mesma linha e Cliente. Exige decisão atual explícita de aceite, revisão da decisão, capacidades de aprovação e gestão, autorização e request id idempotente; preserva o objeto privado original.

Não altera o modelo anterior nem cria URL pública. Consulta/leitura mediada e interface próprias, revogação futura, segurança, retenção, testes e revisão adversarial são necessários antes de qualquer ativação. Decisão posterior de rejeição deve impedir leitura pelo consumidor futuro, não apagar histórico.
