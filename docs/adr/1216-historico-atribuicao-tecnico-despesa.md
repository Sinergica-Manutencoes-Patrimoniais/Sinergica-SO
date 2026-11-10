---
name: "docs-adr-1216-historico-atribuicao-tecnico-despesa-md"
description: "Documento Sinérgica SO: ADR-1216 — Histórico de atribuição de técnico à despesa"
alwaysApply: false
---

# ADR-1216 — Histórico de atribuição de técnico à despesa

## Decisão

Preparar consulta paginada das atribuições de técnico registradas para a despesa, por Cliente e Visita atuais. A entrada exige ator autenticado, capacidade `despesa_visita.gerir` e o gate de resumo. Retorna revisão, motivo, ator, data e identificação do técnico apenas quando o vínculo pertence à mesma Visita e Cliente.

O estado do vínculo é atual, não retrato histórico. A consulta não altera despesa, rateio, pagamento ou cobrança; não comprova execução.

## Gates

Não ativar antes de validar RLS/FORCE, privacidade de motivos, sessão, revogação, transferência, paginação, concorrência e revisão adversarial. A consulta paginada não é uma fotografia entre requisições.
