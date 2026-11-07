---
name: "docs-adr-1289-recibo-comando-capacidades-md"
description: "Documento Sinérgica SO: ADR 1289 — Consulta de recibo de capacidade"
alwaysApply: false
---

# ADR 1289 — Consulta de recibo de capacidade

## Contexto

Alterações administrativas de perfis, vínculos e concessões registram comando idempotente. Uma resposta perdida deixa tentativa local pendente; reenviar ou interpretar um erro posterior não prova o resultado anterior.

## Decisão

Adicionar consulta autenticada restrita ao superadministrador ativo que criou o comando, comparando requestId e payload canônico integral com o registro imutável. Retornar somente confirmação e requestId. Manter gate fechado e não conceder leitura direta da tabela. A interface consulta explicitamente sem repetir escrita e só limpa a mesma tentativa após confirmação e nova checagem de sessão.

Recibo ausente, inacessível ou uma transação ainda em andamento não prova falha. A consulta não altera permissões, não autoriza apagar uma tentativa incerta e não prova que a concessão continue ativa posteriormente.

## Implantação e retorno

Migration aditiva e flag de interface desligada. Validar payloads de três comandos, identidade, autorização e revogação, concorrência com commit, replay, privacidade e RLS/FORCE; revisão adversarial antes de habilitar. Para retorno, desligar flag e gate; não excluir comandos ou auditoria.
