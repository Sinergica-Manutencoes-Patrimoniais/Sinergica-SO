---
name: spec
description: Contrato — fazer o cadastro de serviço no PCM propagar para o Auvo (write path). Hoje enfileira no outbox mas morre no dry-run (writeEnabled:false); GET /services dá 404.
alwaysApply: true
---

# Spec — E01-S74 · Serviço → Auvo (write path)

> **Fonte da verdade.** Status: pronto para implementar (com bloqueio de verificação externa) ·
> Tier: pequeno. Origem: teste de produção do Lucas (2026-07-14) — "cadastrei um serviço e não foi
> pro Auvo".

## Problema (confirmado no código)
A infra outbound de serviço está **completa**: trigger `trg_servicos_auvo_enqueue`
(`0034:63-65`) → `pcm.auvo_sync_outbox` → `pcm-auvo-push`. Mas o descriptor
`registry/servicos.ts:30` tem **`writeEnabled: false`**, e `pcm-auvo-push:74-78` faz short-circuit
em `writeEnabled=false` → devolve `{ok:false, error:"writeEnabled=false, pulado (dry-run)"}` e
**nunca chama o Auvo**. Além disso, `GET /services` retorna **404** em produção (2026-07-08),
provavelmente porque o módulo Serviços não está habilitado no plano Auvo. O `POST`/`PATCH /services`
**nunca foi testado** contra a API real.

## Resumo
Fazer o teste de contrato real de `POST /services` com um registro reversível. Se funcionar, ligar
`writeEnabled:true` e confirmar a propagação via outbox/push. Se `POST` também der 404, é o módulo
Serviços não habilitado no plano Auvo — ação de negócio (Fabrício habilita no Auvo), mantendo
`writeEnabled:false` e um banner honesto na tela de Serviços.

## Critérios de aceite

### AC-1: Teste de contrato de escrita
- **Dado** credencial Auvo real
- **Quando** `POST /services` é testado com um serviço temporário reversível
- **Então** o resultado (aceita / 404 / outro) fica documentado nesta pasta antes de qualquer flip
  de `writeEnabled` (mesma disciplina das demais entidades — lição do `taskID`/E01-S34)

### AC-2: Se escrita OK → propaga
- **Dado** `POST /services` aceito (AC-1)
- **Quando** `writeEnabled:true` é ligado em `registry/servicos.ts`
- **Então** cadastrar um serviço no PCM enfileira no outbox, o drain (`pcm-auvo-push`) faz o POST e
  grava `auvo_id`; editar faz PATCH; verificável pela saúde de sync (`pcm.auvo_entity_status`)

### AC-3: Se escrita 404 → bloqueio honesto
- **Dado** `POST /services` também 404 (módulo não habilitado)
- **Quando** o cadastro de serviço é feito
- **Então** `writeEnabled` permanece `false`, e a tela de Serviços mostra um banner claro: "Serviço
  não sincroniza com o Auvo — módulo Serviços não habilitado no plano Auvo (ação: habilitar no
  Auvo)". Nada de erro silencioso

## Fora de escopo
> Vinculante.
- Reimplementar o motor de sync (a infra já existe; é só o gate `writeEnabled` + verificação).
- Habilitar o módulo Serviços no plano Auvo (ação de negócio do Fabrício, fora do código).

## Rastreabilidade
- Origem: teste Lucas 2026-07-14.
- Arquivos-âncora: `supabase/functions/_shared/auvo/registry/servicos.ts` (`writeEnabled`),
  `supabase/functions/pcm-auvo-push/index.ts:74-78,126-138` (short-circuit + POST/PATCH),
  `supabase/migrations/0034_E01-S31_servicos.sql` (trigger/tabela),
  `apps/web/src/features/pcm/pages/ServicosPage.tsx` (banner).
- Pré-requisito: credencial Auvo (`AUVO_API_KEY`/`AUVO_USER_TOKEN`) no ambiente para o teste de
  contrato; módulo Serviços habilitado no Auvo se 404.
