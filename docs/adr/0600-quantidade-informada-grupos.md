---
name: "docs-adr-0600-quantidade-informada-grupos-md"
description: "Documento Sinérgica SO: ADR-0600 — Preservar quantidade informada para Grupo"
alwaysApply: false
---

# ADR-0600 — Preservar quantidade informada para Grupo

Status: proposta, não homologada.

Importações aceitam quantidade por linha, mas a criação de Grupo recebia quantidade selecionada separadamente sem comprovar coincidência. O fluxo de lote 0810 passa a aceitar quantidade informada apenas se igual à selecionada. A guarda 0825 verifica a quantidade oficial antes de registrar a incorporação, inclusive em outros caminhos; entrada ausente permanece permitida. Valor inválido ou divergente bloqueia a transação, sem descartar informação.

A guarda não inventa código, não altera dados históricos e não corrige divergências existentes. Revisar os caminhos de vínculo e atualização de Grupos, ordem de triggers e concorrência; realizar testes antes de aplicar. Gates existentes permanecem fechados.
