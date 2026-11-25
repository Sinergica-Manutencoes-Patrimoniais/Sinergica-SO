---
name: adr-1702
description: Entrada única de Materiais e Aquisições com contratos e concessões existentes.
alwaysApply: false
---

# ADR-1702 — Entrada única de Materiais e Aquisições

Aceita em 25/11/2026, E01-S179 AC-7/AC-8. Lucas pediu implementar pendências sem dependência externa.

## Decisão
Reusar CentralMateriais e seus comandos mediados, com seletor de Cliente no menu de Trabalho.
Declarar flags existentes necessárias e abrir cinco gates de criação/edição/eventos/listagem/central.
Não abrir publicação no Portal, integração Auvo, novas capacidades ou regras financeiras.
Os comandos continuam exigindo material.gerir por Cliente, request_id e revisão; compras continuam
fornecimento e orçamento da OS, sem criar despesa de Visita ou cobrança automaticamente.
Corrigir filtro de situação para os sete estados já aprovados na migration 1843.

## Segurança e retorno
Migration aditiva; não altera concessão ou dado de negócio. A leitura filtrada preserva gates,
capacidade, recorte por Cliente e paginação. pgTAP explicita gate fechado nos testes que precisam
desse estado, sem enfraquecer asserções. O retorno fecha os cinco gates e desliga flags no Netlify;
listas, versões e eventos continuam preservados. A API antiga aceita todos os parâmetros anteriores.
