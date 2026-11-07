---
name: "docs-adr-1240-recibos-lotes-legados-md"
description: "Documento Sinérgica SO: ADR-1240 — Recibos dos lotes de rascunhos"
alwaysApply: false
---

# ADR-1240 — Recibos dos lotes de rascunhos

## Decisão

Preparar consultas de recibo para criação e avaliação de reversão de lote, restritas ao ator, Cliente e identificadores originais. A consulta de criação exige o vínculo imutável entre aceite e lote; a de reversão exige a correspondência com o lote original. Ambas são somente leitura e retornam null quando o recibo ainda não está visível.

## Limites

Ausência de recibo não prova rollback: uma transação pode estar em andamento. A tentativa deve permanecer preservada e a interface deve validar integralmente os resultados antes de limpá-la. Gates continuam fechados; testar commit concorrente, transferências, revogação, RLS/FORCE, privacidade, sessão e revisão adversarial. Consulta não cria ou reverte Planos.
