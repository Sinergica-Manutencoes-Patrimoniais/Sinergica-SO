---
name: "docs-adr-1095-triagem-processamento-demorado-md"
description: "Documento Sinérgica SO: ADR-1095 — Triagem de processamento demorado"
alwaysApply: false
---

# ADR-1095 — Triagem de processamento demorado

Status: proposta local, não aplicada nem homologada.

## Decisão

Permitir que operador autorizado consulte itens de Sistema e Componente em processamento cujo início observado exceda um limite informado na consulta, além de itens com início desconhecido. A resposta é paginada por ID e não inclui erros brutos, payloads ou credenciais. O limite é apenas filtro operacional, não prazo de lease. Todo item continua com resultado remoto incerto e retry não autorizado.

## Limites

Início desconhecido não prova atraso; tempo excedido não prova abandono ou ausência de efeito remoto. Não alterar status ou despachar. A paginação não forma fotografia e o limite não é configurado como regra automática. Avaliar volume e índices, revogação, Cliente transferido, RLS/FORCE e revisão adversarial antes de abrir gate ou conceder acesso.
