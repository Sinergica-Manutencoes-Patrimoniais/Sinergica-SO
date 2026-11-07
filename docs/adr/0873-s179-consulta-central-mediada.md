---
name: "docs-adr-0873-s179-consulta-central-mediada-md"
description: "Documento Sinérgica SO: ADR 0873 — Mediação da consulta à Central de Materiais"
alwaysApply: false
---

# ADR 0873 — Mediação da consulta à Central de Materiais

## Contexto

A Central já usa consulta paginada por Cliente, mas a função da migration 0355 não concede execução ao usuário autenticado. Autorizar diretamente seu núcleo não oferece gate de implantação nem serialização com revogação.

## Decisão

Introduzir função mediadora para a consulta existente, com gate próprio fechado por padrão, sessão autenticada, READ COMMITTED, trava compartilhada do protocolo de autorização e releitura do gate sob lock. O núcleo privado continua aplicando autorização `material.gerir` e filtro por Cliente, OS, responsável e cursor; sua ACL não muda. Somente authenticated recebe EXECUTE na mediadora. A tela passa a chamar essa função, sem fallback para a função privada.

## Limites

O gate só poderá ser aberto após provas de ACL, concorrência, contrato, integração e revisão adversarial. A mediação desta leitura não libera outras operações de materiais, não corrige eventuais caminhos legados e não prova autorização em produção. Sem alteração de OS, envio externo ou Auvo.
