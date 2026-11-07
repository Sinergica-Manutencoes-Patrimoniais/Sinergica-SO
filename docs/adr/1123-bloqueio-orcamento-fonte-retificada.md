---
name: "docs-adr-1123-bloqueio-orcamento-fonte-retificada-md"
description: "Documento Sinérgica SO: ADR-1123 — Revisão antes de publicar fonte retificada"
alwaysApply: false
---

# ADR-1123 — Revisão antes de publicar fonte retificada

Status: proposta local, não aplicada nem homologada.

Quando uma composição mista da versão corrente usar fonte posteriormente substituída, transições para revisão, aprovação ou publicação devem ser recusadas até nova composição. Uma proposta com uso conhecido de fonte, mas sem fotografia mista da versão corrente, também exige recomposição. A guarda consulta a fotografia preservada, serializa as fontes pelas mesmas travas da retificação e não altera versões antigas. Gates próprios permanecem fechados.

A guarda protege somente versões com fotografia mista identificada. Não invalida documentos já publicados, não decide resposta de cliente, não resolve outras fontes ou caminhos sem fotografia e não confirma identidade física de gastos. Testar transição concorrente à retificação nas duas ordens, rollback de publicação, recomposição, permissões, locks, triggers e revisão adversarial antes de ativar.
