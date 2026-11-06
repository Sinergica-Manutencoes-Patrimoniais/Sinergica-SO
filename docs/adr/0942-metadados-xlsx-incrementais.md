---
name: "docs-adr-0942-metadados-xlsx-incrementais-md"
description: "Documento Sinérgica SO: ADR-0942 — Metadados XLSX incrementais no experimento"
alwaysApply: false
---

# ADR-0942 — Metadados XLSX incrementais no experimento

**Status:** preparação isolada, sem implantação.

Substituir somente no processador experimental a leitura DOM de `workbook.xml` e relações por leitura SAX, mantendo verificação de namespace, IDs, nome, estado e caminho das abas. Strings, células e matriz continuam materializadas e a extração mantém partes em memória.

Não conectar à recepção antes de testes diferenciais, XML/ZIP adversarial, limites reais de recursos, autorização e revisão de segurança. A leitura incremental não demonstra memória constante nem contenção concorrente. ADR-0919 e gates continuam válidos.
