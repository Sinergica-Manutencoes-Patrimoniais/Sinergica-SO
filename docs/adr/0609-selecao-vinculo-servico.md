---
name: "docs-adr-0609-selecao-vinculo-servico-md"
description: "Documento Sinérgica SO: ADR-0609 — Seleção autorizada do vínculo declarado"
alwaysApply: false
---

# ADR-0609 — Seleção autorizada do vínculo declarado

Consulta limitada por Cliente e declaração, retornando apenas snapshot existente e associações de evidência/resposta da mesma OS. O limite explícito não representa histórico completo. A interface informa que evidência declarada não é execução autenticada; nenhum faturável é criado. Gate fechado e funções sem concessão pública. Revisar permissões, paginação, locks, concorrência e testar antes de ativar.
