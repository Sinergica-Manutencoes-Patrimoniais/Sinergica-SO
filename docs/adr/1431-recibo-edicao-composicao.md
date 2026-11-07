---
name: "docs-adr-1431-recibo-edicao-composicao-md"
description: "Documento Sinérgica SO: ADR-1431 — Recibo de edição de composição"
alwaysApply: false
---

# ADR-1431 — Recibo de edição de composição

Permitir ao mesmo ator consultar a tentativa exata sem reenviar a escrita, mediante autorização atual de `custo.ler` e `orcamento.emitir` no Cliente. A consulta compara todos os parâmetros e usa a trava do request; tentativa em andamento ou ausente não prova falha e não autoriza outra edição. Retorno limita-se a identidade e versão, sem expor itens ou custos novamente.

Gate existente permanece fechado. Validar concorrência, revogação, igualdade do payload, isolamento, RLS/FORCE e revisão adversarial antes de ativar.
