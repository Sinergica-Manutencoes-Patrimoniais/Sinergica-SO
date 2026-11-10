---
name: "docs-adr-0833-dispatch-storage-serializacao-autorizacao-md"
description: "Documento Sinérgica SO: ADR-0833 — Dispatcher privado com serialização de autorização"
alwaysApply: false
---

# ADR-0833 — Dispatcher privado com serialização de autorização

Status: preparação desconectada, não autoriza alteração de policies ou rollout.

## Contexto

O dispatcher experimental da 0996 evita falhas de ACL entre policies de
buckets distintos, mas em prova com duas sessões um upload de foto de Grupo
confirmou depois da desativação do usuário. A origem de autorização mudou
enquanto a transação de upload permanecia aberta.

## Decisão

Preparar dispatcher privado sem concessões aos papéis de aplicação. Antes de
delegar à 0996, exigir READ COMMITTED e adquirir, sem espera, trava compartilhada
transacional `sso-autorizacao-confirmacao-visita`, correspondente ao protocolo
dos escritores de autorização existente. A contenção nega o upload. Não se
altera ACL de helpers, policies, gates, Storage ou direitos de bucket.

## Limites e ativação

Esta preparação não garante serialização de alteração de gates, vínculos,
estado das entidades ou grants/revokes SQL. Não resolve, isoladamente, a
falha de 0966: nenhuma policy é conectada. Provar todas as fontes e ambas as
ordens concorrentes, compatibilidade e Storage real, avaliar contenção e fazer
revisão adversarial antes de eventual migration de ativação. Não homologar.
