---
name: "docs-adr-0155-cobranca-publica-por-os-md"
description: "Documento Sinérgica SO: ADR-0155 — Cobrança publicada vinculada à OS"
alwaysApply: false
---

# ADR-0155 — Cobrança publicada vinculada à OS

**Estado:** proposta preparatória, não homologada nem implantada.

O Portal somente apresenta cobrança de OS quando Financeiro publica explicitamente uma descrição própria para o Cliente, associando uma entrada financeira existente que já esteja vinculada à mesma OS e ao mesmo Cliente. O valor, competência e vencimento são capturados do lançamento na publicação; se forem alterados, a publicação fica oculta até nova revisão. O estado de pagamento vem do lançamento atual. Nenhuma publicação cria lançamento, cobrança, documento, link de pagamento ou comprovante; custos internos e comprovantes de despesa não entram na projeção.

Publicações são versionadas e imutáveis. As RPCs permanecem revogadas e a interface desligada. Conteúdo textual precisa ser revisto pelo responsável, pois filtros sintáticos não detectam dados sigilosos. Ainda é necessário validar concorrência, revogação, atualizações e cancelamento do lançamento, regras de autorização por contato, integração financeira e tratamento de documentos públicos antes da ativação. Os caminhos antigos do Portal Financeiro exigem sua própria revisão de acesso e não são protegidos por esta proposta.
