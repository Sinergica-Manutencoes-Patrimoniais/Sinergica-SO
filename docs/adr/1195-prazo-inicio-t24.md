---
name: "docs-adr-1195-prazo-inicio-t24-md"
description: "Documento Sinérgica SO: ADR-1195 — Prazo de início de efeito T−24"
alwaysApply: false
---

# ADR-1195 — Prazo de início de efeito T−24

## Contexto

O prazo do lote era conferido apenas antes de reservar cada candidata. Uma busca ou leitura demorada poderia ultrapassar esse prazo e ainda assim iniciar uma ação remota.

## Decisão

Propagar ao processamento da candidata uma verificação do prazo do lote. Conferir antes de registrar o início e novamente imediatamente antes de POST ou PATCH. Se o prazo expirar antes do início, registrar bloqueio; se expirar após o registro do início e antes do efeito, encaminhar à reconciliação. Relógio inválido ou regressivo também bloqueia.

## Limitações

A conferência não cancela um efeito já iniciado e não elimina a janela entre a verificação e a chamada remota. Não comprova rollback de RPC ou de requisição. Sem conexão de rede, cron ou liberação operacional. Validar relógio, tempos limite, repetição, persistência de resultados e concorrência antes da habilitação.
