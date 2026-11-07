---
name: "docs-adr-0056-leitura-regras-contratuais-md"
description: "Documento Sinérgica SO: ADR-0056 — Leitura mínima de regras contratuais"
alwaysApply: false
---

# ADR-0056 — Leitura mínima de regras contratuais

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

O gestor consulta versões de regras por Cliente via projeção paginada, contendo somente identificadores, parâmetros operacionais e vigências. A consulta exige `plano.gerir` atual e não apresenta dados comerciais privados ou dados de outros Clientes. A resposta descreve regras cadastradas, não comprova Visitas, Ocorrências, capacidade ou homologação. Paginação usa o identificador da versão e não deduz estado operacional.
