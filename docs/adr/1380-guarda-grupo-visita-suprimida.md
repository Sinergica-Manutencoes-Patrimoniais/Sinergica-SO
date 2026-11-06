---
name: "docs-adr-1380-guarda-grupo-visita-suprimida-md"
description: "Documento Sinérgica SO: ADR-1380 — Guarda de vínculos de Grupo em Visita suprimida"
alwaysApply: false
---

# ADR-1380 — Guarda de vínculos de Grupo em Visita suprimida

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar guarda transacional nos pontos conhecidos que adicionam vínculos, intenção, decisões de intenção, atestados, fotos, decisões, quantidades e Pendências a uma ocorrência de Grupo. Para Grupo originado em Visita, a guarda identifica a Visita, coordena suas travas e rejeita nova associação quando há supressão por feriado. Grupos de calendário não são afetados. Uma Pendência existente só passa pela guarda quando seu vínculo de Grupo é criado ou alterado.

O gate de coordenação inicia desligado; mesmo desligado, uma supressão já registrada é respeitada. Enquanto o gate estiver desligado, a supressão de Visita com Grupo continua proibida. A guarda não suprime Visitas e não altera cadastros ou registros existentes.

## Limites

Não libera supressão de Grupo: todos os leitores, demais escritores, referências indiretas e históricos ainda precisam de inventário e adaptação. Antes de habilitar, validar locks em ambas as ordens, RLS/FORCE, gatilhos legados, direitos, concorrência, corrida com gate e revisão adversarial. Migration não aplicada nem testada.
