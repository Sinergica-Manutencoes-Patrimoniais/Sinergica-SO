---
name: "docs-adr-1155-protecao-evento-material-vinculado-md"
description: "Documento Sinérgica SO: ADR-1155 — Proteção de evento de material vinculado"
alwaysApply: false
---

# ADR-1155 — Proteção de evento de material vinculado

Status: proposta local, não aplicada nem homologada.

Enquanto for criada a relação com uma intenção, o evento de exceção é bloqueado para escrita. Depois, um trigger impede alteração ou exclusão do evento quando existir referência de origem. Dados não vinculados continuam sob os contratos anteriores. A correção de um evento vinculado deve ser representada por novo registro; não reescrever histórico.

Validar todos os escritores, privilégio e FORCE RLS do dono da função, corrida nas duas ordens, contexto de migração, cascatas, rollback e compatibilidade antes da aplicação. A trava de origem e o trigger não comprovam autorização ou estado atual da exceção; gates permanecem fechados.
