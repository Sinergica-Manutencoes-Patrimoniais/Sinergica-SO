---
name: "docs-adr-0274-conferencia-despesa-visita-md"
description: "Documento Sinérgica SO: ADR-0274 — Conferência operacional da despesa"
alwaysApply: false
---

# ADR-0274 — Conferência operacional da despesa

Status: proposta; gate e funções fechados, testes pendentes.

A especificação E01-S180 não autoriza criar contas a pagar ou inferir pagamento. Esta fatia apenas apresenta, para PCM autorizado, a existência do comprovante privado mais recente e a integridade aparente do rateio registrado, distinguindo inexistente de divergente e informando valores e base. Parcelas sem vínculo identificável são informação incompleta, nunca sucesso; uma soma que confere não é validação de conteúdo ou autorização. Não valida conteúdo do arquivo, aprovação financeira ou pagamento; não expõe caminhos nem altera despesas, cobranças ou Financeiro. A leitura exige Cliente, Visita e permissão atuais. Revisão concorrente, isolamento, armazenamento e rateios históricos requerem testes antes da ativação.
