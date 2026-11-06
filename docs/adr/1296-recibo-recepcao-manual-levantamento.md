---
name: "docs-adr-1296-recibo-recepcao-manual-levantamento-md"
description: "Documento Sinérgica SO: ADR-1296 — Recibo da recepção manual de levantamento"
alwaysApply: false
---

# ADR-1296 — Recibo da recepção manual de levantamento

## Contexto

A recepção pode ter sido confirmada no banco mesmo quando a resposta não chegou ao navegador. A repetição deve preservar o mesmo pedido e não criar outro levantamento.

## Decisão

Adicionar consulta restrita ao ator e Cliente do pedido, com capacidade atual `cadastro.gerir`, gate fechado por padrão e comparação integral do payload canônico. A consulta usa a mesma trava transacional por request da recepção antes de procurar o recibo e verifica o vínculo do lote ao Cliente. Ela não grava nem incorpora dados. Um recibo indisponível não prova que a tentativa falhou ou não será recebida posteriormente e não autoriza descartar pedido ou enviar outro.

## Consequências

O cliente pode recuperar confirmação sem repetir escrita. A ausência continua exigindo reconciliação própria; não resolve cancelamento ou recusa definitiva. Migrations, permissões, locks, concorrência, revogação e revisão adversarial são pré-requisitos de habilitação.
