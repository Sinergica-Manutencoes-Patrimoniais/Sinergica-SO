---
name: "docs-adr-1331-conferencia-temporal-evidencias-onda-md"
description: "Documento Sinérgica SO: ADR-1331 — Conferência temporal de evidências da onda"
alwaysApply: false
---

# ADR-1331 — Conferência temporal de evidências da onda

Status: preparado, gate desligado.

A decisão de onda seleciona evidências por revisão de registro; a matriz usa a
data de execução. Com a guarda habilitada, ambas precisam concordar quanto à
última execução por cenário, Cliente, onda, versão e ambiente. Datas inválidas,
evidência selecionada incompleta ou qualquer falha/bloqueio empatado na última
data impedem a decisão. O horário conserva a precisão do PostgreSQL; a matriz
pode tratar tempos muito próximos como empate conservador pela precisão do JS.

O comando continua declaratório: isso não comprova execução, autenticidade de
artefatos, CI ou aceite. Gate fechado até inventariar dados antigos, revisar
as ondas sem cenários, empates, concorrência, RLS e a equivalência com a matriz.
Não modifica decisões anteriores. Rollback desliga o gate; não elimina histórico.
