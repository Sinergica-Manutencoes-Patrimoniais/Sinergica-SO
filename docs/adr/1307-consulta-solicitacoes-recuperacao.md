---
name: "docs-adr-1307-consulta-solicitacoes-recuperacao-md"
description: "Documento Sinérgica SO: ADR-1307 — Consulta de solicitações de recuperação"
alwaysApply: false
---

# ADR-1307 — Consulta de solicitações de recuperação

## Decisão

Adicionar leitura paginada das solicitações de um item específico da fila,
com autorização atual por Cliente e verificação do vínculo da origem por meio
da prévia existente. A consulta retorna motivo, ator e revisão declarados,
mas não payload, credenciais ou conteúdo externo. Usa o mesmo gate de
solicitação e uma flag própria de interface, ambos fechados por padrão.

O histórico é imutável e não é uma fila de execução: não informa se o
proprietário recebeu, tratou ou concluiu a solicitação e não permite retry.
Integração e tratamento pelo proprietário continuam pendentes.

## Antes de habilitar

Validar paginação sob concorrência, privilégios, Cliente, transferência de
origem, exclusão, retenção, privacidade do motivo, RLS/FORCE, revogação,
acessibilidade e revisão adversarial.
