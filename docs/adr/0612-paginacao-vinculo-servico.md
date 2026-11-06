---
name: "docs-adr-0612-paginacao-vinculo-servico-md"
description: "Documento Sinérgica SO: ADR-0612 — Paginação de evidências para vínculo"
alwaysApply: false
---

# ADR-0612 — Paginação de evidências para vínculo

A consulta autorizada usa cursor estável pelo identificador da associação e limite validado. A interface oferece carregar páginas adicionais, sem interpretar uma página vazia como inexistência global. O comando continua revalidando Cliente e OS no servidor. O gate permanece fechado; testar paginação, permissões e alterações concorrentes antes de ativar.
