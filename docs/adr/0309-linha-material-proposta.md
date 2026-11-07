---
name: "docs-adr-0309-linha-material-proposta-md"
description: "Documento Sinérgica SO: ADR-0309 — Vínculo preliminar à linha pública aprovada"
alwaysApply: false
---

# ADR-0309 — Vínculo preliminar à linha pública aprovada

Status: proposta; gates fechados, sem testes.

Uma declaração aceita e já vinculada à proposta pode ser associada a uma linha de seu snapshot público versionado, mediante indicação humana de quantidade inteira e preço unitário que deve ser idêntico ao publicado. A soma das quantidades vinculadas à linha não pode exceder a quantidade publicada; a proposta é bloqueada para serializar vínculos concorrentes. Esta associação não prova consumo, entrega, aceite de item separado nem elegibilidade faturável, e não cria item ou cobrança. Falta regra de não duplicidade com faturamento do orçamento global e revisão do contrato de itens antes de qualquer geração financeira. Snapshots antigos sem estrutura não são inferidos.
