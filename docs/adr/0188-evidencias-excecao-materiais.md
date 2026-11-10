---
name: "docs-adr-0188-evidencias-excecao-materiais-md"
description: "Documento Sinérgica SO: ADR-0188 — Evidência privada vinculada à exceção de materiais"
alwaysApply: false
---

# ADR-0188 — Evidência privada vinculada à exceção de materiais

## Decisão

Preparar bucket privado JPEG/PNG para evidência associada a evento real de exceção (lista + revisão), com escopo de Cliente, upload de dono autorizado, vínculo auditado e retry por requestId. Leitura direta, edição e exclusão de objeto pelo cliente ficam bloqueadas; entrega por função autenticada revalida capacidade antes e após download, sem URL assinada. Gate fechado e funções revogadas.

## Limites

Assinatura de arquivo não substitui sanitização ou antivírus; fotos podem conter metadados sensíveis. Fluxo não captura diretamente dados Auvo nem modifica OS, compras ou faturáveis. Revisar retenção/órfãos, políticas Storage, concorrência e revogação antes de implantar. Sem aplicação ou testes.
