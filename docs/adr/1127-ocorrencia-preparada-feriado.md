---
name: "docs-adr-1127-ocorrencia-preparada-feriado-md"
description: "Documento Sinérgica SO: ADR-1127 — Ocorrência preparada em Visita suprimida"
alwaysApply: false
---

# ADR-1127 — Ocorrência preparada em Visita suprimida

Status: proposta local, não aplicada nem homologada.

Uma ocorrência por Visita já preparada, mas sem vínculo legado, materialização, identidade canônica ou registro de Grupo, pode permanecer preservada quando a Visita futura é suprimida por feriado. A associação de supressão à Visita também identifica suas ocorrências; novos vínculos nessas quatro fontes devem ser recusados. Os locks da Visita e da ocorrência serializam criação de vínculo com supressão. Não há ocorrência operacional, reposição automática ou exclusão de histórico.

Antes de ativar, todos os consumidores devem excluir ocorrências suprimidas de filas, indicadores, capacidade e cronograma; os comandos legados e escritores fora das quatro fontes também precisam de inventário. Validar concorrência, ordem de locks, vínculos preexistentes, bloqueio direto, RLS/FORCE e revisão adversarial. O gate permanece fechado; casos com qualquer vínculo exigem reconciliação própria.
