---
name: "docs-adr-0674-historico-interno-orcamento-legado-md"
description: "Documento Sinérgica SO: ADR-0674 — Histórico interno de orçamento legado por OS"
alwaysApply: false
---

# ADR-0674 — Histórico interno de orçamento legado por OS

Consulta limitada por Cliente e OS reutiliza os registros e decisões legados, sem reemitir ou migrar propostas. A projeção retorna identidade, estado, datas e decisão; não retorna itens, preços, descrição livre, notas, custos ou margem, pois sua natureza comercial e segurança não são comprovadas. Registros pré-OS ou sem vínculo verificável não são incluídos; ausência da lista não prova ausência de histórico.

Permissão `orcamento.emitir`, Cliente e OS são revalidados no servidor a cada consulta; acesso é interno e não destinado ao Portal. Gate fechado e sem concessão a papéis da aplicação. Antes de ativar, revisar autorização, RLS, paginação, histórico legado incompleto e testar isolamento entre Clientes/revogação.
