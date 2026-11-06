---
name: "docs-adr-1549-fotografia-retorno-calendario-md"
description: "Documento Sinérgica SO: ADR-1549 — Fotografia da OS para retorno de calendário"
alwaysApply: false
---

# ADR-1549 — Fotografia da OS para retorno de calendário

Os consumidores de classificação e cobertura preparados para fotografia de OS por Visita também devem utilizar a fotografia de OS por calendário. A versão operacional posterior da ocorrência não altera a versão e as perguntas já usadas pela OS anterior. Sem fotografia, preservar a leitura histórica preexistente; dados ausentes não são reconstruídos.

A mudança amplia os ramos da 1692 para ambos os modos, sem novo gate e sem alterar histórico, OS ou guarda 1045. Deve ser aplicada após 1689/1692 em conjunto com os consumidores. Pendências técnicas continuam seguindo seus vínculos existentes: OS nativa sem ocorrência legada não recebe vínculo inventado, nem se afirma que a pendência esteja implementada para esse caso. Validar ambos os modos, OS antigas/novas, isolamento por Cliente, perguntas, concorrência e revisão adversarial antes de homologar.
