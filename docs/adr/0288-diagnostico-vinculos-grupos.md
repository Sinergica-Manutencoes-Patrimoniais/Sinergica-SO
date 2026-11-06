---
name: "docs-adr-0288-diagnostico-vinculos-grupos-md"
description: "Documento Sinérgica SO: ADR-0288 — Diagnóstico agregado de vínculos de Grupos"
alwaysApply: false
---

# ADR-0288 — Diagnóstico agregado de vínculos de Grupos

Consulta privada e desligada contabiliza Grupos ativos do Cliente com Local/Área indisponível ou incompatível e com Sistema informado indisponível ou incompatível. Somente contagens são expostas, com autorização atual; não retorna informações de outros Clientes nem modifica registros. Um Grupo pode aparecer nas duas contagens.

A verificação cobre apenas vínculos imediatos e não detecta ciclos de ancestrais; não substitui diagnóstico integral da árvore. Testes de segurança e revisão são necessários antes de ativar.
