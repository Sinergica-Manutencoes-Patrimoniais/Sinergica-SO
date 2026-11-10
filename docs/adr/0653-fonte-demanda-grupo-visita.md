---
name: "docs-adr-0653-fonte-demanda-grupo-visita-md"
description: "Documento Sinérgica SO: ADR-0653 — Fonte parcial de demanda de Grupo por Visita"
alwaysApply: false
---

# ADR-0653 — Fonte parcial de demanda de Grupo por Visita

Consulta autorizada associa ocorrência Grupo de Visita à OS declarada e ao vínculo ativo da mesma OS na mesma Visita, filtrada pela semana civil da Visita. Mostra estimativa histórica por unidade separadamente da estimativa da OS; não soma valores, pois podem representar o mesmo trabalho. Tempo ausente permanece a validar.

A consulta é fonte parcial, não altera ou completa o horizonte 0454, não inclui Grupo por calendário sem Visita comprovada, não comprova execução nem reserva capacidade. Gates de demanda e esforço permanecem fechados; concorrência, testes e homologação pendentes.
