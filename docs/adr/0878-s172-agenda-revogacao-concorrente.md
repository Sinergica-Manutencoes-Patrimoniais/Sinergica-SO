---
name: "docs-adr-0878-s172-agenda-revogacao-concorrente-md"
description: "Documento Sinérgica SO: ADR 0878 — Serialização da leitura de agenda com revogação"
alwaysApply: false
---

# ADR 0878 — Serialização da leitura de agenda com revogação

## Contexto

A leitura de 1054 usa RLS nativa como invoker e checa capacidade, mas não participa da trava de autorização. Em ensaio isolado, uma revogação não confirmada estava em andamento e a consulta ainda retornou a agenda.

## Decisão

Adicionar helper privado de gate que exige READ COMMITTED, trava compartilhada do protocolo de autorização e leitura do gate sob lock, falhando fechado. A consulta continua SECURITY INVOKER, com os mesmos filtros, checagem de capacidade e RLS nativa; passa a VOLATILE para usar estado atualizado após espera. Não alterar ACL da tabela de agenda nem abrir o gate.

## Limites

O helper executável por authenticated só valida gate e trava; não retorna agenda ou dados. Falta prova de todas fontes de autorização, integração oficial e revisão adversarial. Disponibilidade e execução não são inferidas da agenda manual. Sem deploy ou Auvo.
