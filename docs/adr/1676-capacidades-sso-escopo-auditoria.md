---
name: adr-1676-capacidades-sso-escopo-auditoria
description: Modelo de autorização atual por capacidade, ação e Cliente para gestão do Plano.
alwaysApply: false
---

# ADR-1676 — Capacidades SSO com escopo e auditoria

## Estado

Proposta pendente de revisão arquitetural, execução integrada e homologação. Não autoriza deploy.

## Contexto

A gestão do Plano exige permissões explícitas por ação e Cliente, além da decisão de aprovação própria definida operacionalmente. Reutilizar apenas papel ou token de sessão não representa revogações e mudanças recentes de escopo.

## Decisão

Representar as permissões por capacidade, ação e escopo de Cliente; resolver a autorização no servidor usando o estado atual; manter eventos de concessão, revogação e decisão em trilha append-only com ator, motivo, correlação e estado anterior/posterior. A interface reflete as capacidades efetivas, mas não é autoridade de autorização. A política de autoaprovação segue a decisão operacional registrada na spec da E01-S170.

## Consequências

Comandos e consultas devem validar autorização e escopo no servidor, com RLS e testes positivos/negativos. Mudanças de capacidade invalidam o estado de autorização lido pela interface. Papéis existentes continuam componíveis; a nova capacidade não concede acesso técnico nem contorna políticas atuais.

## Validação pendente

Revisão arquitetural, pgTAP com isolamento entre Clientes, revogação concorrente, idempotência, trilha de auditoria e CI com testes de banco habilitados antes de PASS.
