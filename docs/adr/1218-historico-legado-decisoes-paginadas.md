---
name: "docs-adr-1218-historico-legado-decisoes-paginadas-md"
description: "Documento Sinérgica SO: ADR-1218 — Paginação separada de orçamentos legados e decisões"
alwaysApply: false
---

# ADR-1218 — Paginação separada de orçamentos legados e decisões

## Contexto

A consulta legada junta decisões antes de paginar por orçamento. Um orçamento com várias decisões pode ocupar a fronteira da página e ocultar decisões ou produzir IDs repetidos. Recusar a página evita perda silenciosa, mas não permite consultar o histórico.

## Decisão

Preparar leitura de uma linha por orçamento vinculado à OS e leitura independente, paginada por ID, das decisões do orçamento selecionado. Ambas exigem ator, Cliente, OS atual, capacidade `orcamento.emitir` e gate existente. Não retorna custos ou itens e não altera orçamento nem decisão.

As consultas são independentes, não snapshot; autorização, vínculos e conteúdo podem mudar entre páginas. Sem vínculo à OS, o orçamento continua na consulta pré-OS própria e não é inferido.

## Gates

Manter flag e gate fechados até validar RLS/FORCE, múltiplas decisões, ordenação, alteração concorrente, revogação, transferência e revisão adversarial. Não ativar substituição da via pré-OS até implementar e validar sua paginação equivalente.
