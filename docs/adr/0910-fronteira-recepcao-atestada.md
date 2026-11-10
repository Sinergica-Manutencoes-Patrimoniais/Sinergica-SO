---
name: "docs-adr-0910-fronteira-recepcao-atestada-md"
description: "Documento Sinérgica SO: ADR-0910 — Fronteira HTTP da recepção atestada"
alwaysApply: false
---

# ADR-0910 — Fronteira HTTP da recepção atestada

Data: 2026-10-30 · Status: preparação, não publicada.

A fronteira não registrada reaproveita limite de corpo, prazo e autorização anteriores à leitura. Requer UUIDs de pedido e lote definidos pela tentativa. Após leitura, chama serviço atestado e retorna somente recibo de staging com os mesmos IDs. A falha após iniciar o serviço é tratada como resultado incerto: a tentativa deve ser repetida com os mesmos IDs. Não retornar matriz, arquivo, atestado ou segredo. Prévia local continua separada da gravação.

Sem registrar endpoint ou abrir gates até provar autenticação real, persistência, concorrência, CORS, disponibilidade do worker e gestão de segredo. Rollback é manter rota e gates fechados. Não alterar fluxo CSV nem executar tarefas Auvo.
