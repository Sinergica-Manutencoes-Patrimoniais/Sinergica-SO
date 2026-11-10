---
name: "docs-adr-1251-atribuicao-codigo-grupo-existente-md"
description: "Documento Sinérgica SO: ADR-1251 — Atribuição inicial a Grupo existente"
alwaysApply: false
---

# ADR-1251 — Atribuição inicial a Grupo existente

**Status:** proposta local, não homologada. Complementa ADR-1244.

Preparar entrada autenticada com gate fechado para atribuir um código inicial a Grupo existente. A entrada confere explicitamente o Cliente informado e delega ao núcleo privado, que verifica capacidade, Grupo, código e colisões conhecidas. O request identifica tentativa repetível e a atribuição é auditada.

Antes de liberar, concluir proteção de todos os escritores e reservas, integração com staging, revisão de autorização concorrente e testes de rollback, colisões, repetição, ACL/RLS e travas. A operação não altera os códigos já existentes e não cria etiquetas ou tarefa no Auvo.
