---
name: "docs-adr-1344-interface-importacao-xlsx-operacional-md"
description: "Documento Sinérgica SO: ADR-1344 — Disponibilidade controlada da importação XLSX de estrutura"
alwaysApply: false
---

# ADR-1344 — Disponibilidade controlada da importação XLSX de estrutura

**Estado:** proposta; não implantada nem homologada.

## Contexto

A interface de recepção de planilha estruturada foi limitada a builds de desenvolvimento, mesmo com recepção e conferência separadas. Isso impede disponibilizar o fluxo em um build operacional após revisão, sem nova alteração de código.

## Decisão

Preparar flag específica de interface, desligada por padrão, além da flag experimental de desenvolvimento. Quando habilitada, a mesma prévia e o mesmo envio encaminham o lote para conferência, sem incorporar registros oficiais. A habilitação da interface não registra nem implanta a função Edge e não altera o gate independente de recepção no servidor.

## Limites

O caminho operacional depende de função registrada e implantada por DevOps, configuração e rotação de segredos, limites, Auth/RLS, revisão de parser, concorrência e provas integradas. Nenhuma dessas etapas é autorizada por esta mudança. Não habilitar flag ou gate antes de testes e revisão adversarial. Uma falha ou ausência de recibo não prova que o lote deixou de ser recebido.
