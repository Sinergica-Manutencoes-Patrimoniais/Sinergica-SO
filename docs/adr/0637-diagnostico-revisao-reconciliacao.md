---
name: "docs-adr-0637-diagnostico-revisao-reconciliacao-md"
description: "Documento Sinérgica SO: ADR-0637 — Diagnóstico de vigência sem liberação"
alwaysApply: false
---

# ADR-0637 — Diagnóstico de vigência sem liberação

Diagnóstico de leitura compara o estado e a revisão atuais do material com os dados capturados em 0860. Decisões anteriores sem captura são classificadas como revisão desconhecida. O resultado não constitui prova de exclusividade e não altera a guarda fail-closed 0857: qualquer decisão existente continua bloqueando nova candidatura pelo caminho protegido. Não permite faturamento nem altera origens. Gate fechado; testar acesso, concorrência e caminhos alternativos antes de ativar.
