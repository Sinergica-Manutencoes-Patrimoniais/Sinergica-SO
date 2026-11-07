---
name: "docs-adr-1114-guarda-itens-operacionais-md"
description: "Documento Sinérgica SO: ADR-1114 — Guarda da composição de proposta operacional"
alwaysApply: false
---

# ADR-1114 — Guarda da composição de proposta operacional

Status: proposta local, não aplicada nem homologada.

## Decisão

Quando o gate de composição mista estiver aberto, preparar guardas de escrita em itens e campos de composição de propostas com origem operacional já vinculada. As guardas exigem token privado por transação, ator e proposta emitido pelo comando misto. Com gate fechado, mantêm comportamento legado. Propostas sem origem operacional comprovada não são classificadas por inferência.

## Limites

Uma proposta ainda sem vínculo operacional e outros caminhos que não escrevem nas tabelas protegidas permanecem fora da garantia. A guarda afeta consumidores legados de itens e campos de composição, inclusive fluxos administrativos; inventariar, planejar rollout e testar estado, concorrência, owner/FORCE RLS, grants, rollback e revisão adversarial antes de ativar. Não garante ausência de duplicidade física ou protege todas as fontes financeiras.
