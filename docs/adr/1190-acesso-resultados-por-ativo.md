---
name: "docs-adr-1190-acesso-resultados-por-ativo-md"
description: "Documento Sinérgica SO: ADR-1190 — Acesso mediado aos resultados por ativo"
alwaysApply: false
---

# ADR-1190 — Acesso mediado aos resultados por ativo

**Status:** proposta local; não homologada.

## Contexto

A consulta de resultados preparada pela migration 0694 permanece privada. A busca de ativos do ADR-1189 não resolve o acesso à consulta de resultados.

## Decisão

Preparar entrada mediada com ator e Cliente esperados, autorização atual de `execucao.validar` e trava compartilhada de autorização. A entrada reutiliza a consulta existente, conserva o gate fechado e concede apenas execução da função mediada ao papel autenticado. A interface usa o novo contrato somente sob flag própria.

## Limites

Não comprova identidade do questionário, proveniência, cobertura, serialização de todos os escritores de autorização ou RLS/FORCE. Antes de habilitar, testar isolamento, revogação concorrente, paginação, mudanças de Cliente/ativo, funções legadas e revisão adversarial. Nenhum resultado ou Pendência é criado.
