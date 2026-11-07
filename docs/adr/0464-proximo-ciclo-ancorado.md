---
name: "docs-adr-0464-proximo-ciclo-ancorado-md"
description: "Documento Sinérgica SO: ADR-0464 — Próximo ciclo preservando âncora"
alwaysApply: false
---

# ADR-0464 — Próximo ciclo preservando âncora

Status: preparado, gate fechado, não aplicado nem homologado. O cálculo existente 0301 já deriva cada ciclo da data-base congelada e não usa data de execução. Esta consulta recebe índice do ciclo, calcula o próximo pela mesma âncora, respeita vigência da versão e informa apenas feriado geral declarado do Cliente; ausência não comprova dia útil, e feriados de contrato não são consultados.

Não reprograma, gera ocorrência ou OS e não interpreta execução tardia como nova âncora. Próximo ciclo fora de vigência é indeterminado por esta versão. Testes de fronteira de calendário/feriado, permissões e revisão adversarial permanecem pendentes.
