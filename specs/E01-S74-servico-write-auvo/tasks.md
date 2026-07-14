---
name: tasks
description: Decomposição e gates — serviço → Auvo (write path), bloqueado por teste de contrato.
alwaysApply: false
---

# Tasks — E01-S74 · Serviço → Auvo

> Marcar owner no ROADMAP. Branch: `feat/E01-S74-servico-write-auvo`. **Bloqueado por verificação
> externa** (teste de contrato + possível habilitação de módulo no Auvo).

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Teste de contrato: `POST /services` com serviço temporário reversível (credencial Auvo real); documentar resultado no `spec.md` (seção Problema) — aceita / 404 / outro | AC-1 | credencial Auvo | manual (curl) | todo |
| 2a | **Se OK:** ligar `writeEnabled:true` em `registry/servicos.ts`; confirmar POST/PATCH via `pcm-auvo-push`; teste Deno do descriptor; verificar `auvo_entity_status` | AC-2 | 1 | `deno test` (CI) | todo |
| 2b | **Se 404:** manter `writeEnabled:false`; banner honesto em `ServicosPage.tsx` ("não sincroniza — módulo não habilitado no Auvo"); documentar ação de negócio | AC-3 | 1 | `pnpm run test` | todo |
| 3 | `pnpm run ci:local` + verificação (cadastrar serviço → propaga OU banner aparece) + ROADMAP/STATE | todos | 2a/2b | `pnpm run ci:local` | todo |

## Plano de teste
- Manual: `POST /services` real (task 1) — decide o caminho.
- Se OK: cadastrar serviço no PCM e conferir `auvo_id` gravado + saúde de sync.
- Se 404: banner visível na tela de Serviços.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Resultado da task 1 documentado no `spec.md` (não deixar "não testado" pendurado)
- [ ] AC verdes conforme o caminho (2a ou 2b) · `ci:local` verde · ROADMAP/STATE atualizados
