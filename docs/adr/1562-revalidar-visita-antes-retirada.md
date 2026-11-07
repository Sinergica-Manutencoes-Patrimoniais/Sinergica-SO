---
name: "docs-adr-1562-revalidar-visita-antes-retirada-md"
description: "Documento Sinérgica SO: ADR-1562 — Revalidar Visita antes da retirada"
alwaysApply: false
---

# ADR-1562 — Revalidar Visita antes da retirada

A escolha aprovada pode ficar obsoleta antes da vigência. A retirada da fila antiga revalida a fotografia da Visita candidata e os feriados declarados, sob as travas da função canônica, antes de qualquer cancelamento. Se a candidata mudou ou ficou inelegível, a entrada permanece pendente; o recibo registra esse resultado e uma tentativa posterior exige nova requisição. As demais retiradas permanecem inalteradas. Fontes externas de feriado não são consideradas completas. Conflito de trava aborta a transação, preservando a fila.
