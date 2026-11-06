---
name: "docs-adr-1317-destino-foto-verificada-grupo-md"
description: "Documento Sinérgica SO: ADR-1317 — Consulta de destino de foto verificada para Grupo"
alwaysApply: false
---

# ADR-1317 — Consulta de destino de foto verificada para Grupo

## Decisão

Preparar consulta autenticada do Grupo originado da mesma linha de
levantamento, da última decisão de foto, da confirmação de ingestão e do
vínculo existente. Se houver mais de um Grupo candidato, falhar fechado.
Não retornar caminho, digest ou dados de outro Cliente.

A consulta é uma prévia, não garante que a decisão ou o Grupo não mudem antes
do comando; o vínculo continua revalidando no servidor. Nenhum byte é copiado.

## Antes de habilitar

Validar origem, unicidade, autorização/revogação, foto inadequada, retirada,
revisão, concorrência, RLS/FORCE, acessibilidade e revisão adversarial.
