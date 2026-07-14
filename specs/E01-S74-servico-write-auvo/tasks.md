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
| 1 | Teste de contrato: `POST /services` com serviço temporário reversível (credencial Auvo real); documentar resultado no `spec.md` (seção Problema) — aceita / 404 / outro | AC-1 | credencial Auvo | manual (curl) | done — POST 201, PATCH 200, GET-por-id 200; só a listagem 404 |
| 2a | **Se OK:** ligar `writeEnabled:true` em `registry/servicos.ts`; confirmar POST/PATCH via `pcm-auvo-push`; teste Deno do descriptor; verificar `auvo_entity_status` | AC-2 | 1 | `deno test` (CI) | done (Deno não roda local — escrito, CI executa) |
| 2b | ~~Se 404: banner honesto~~ — não se aplica (POST/PATCH aceitos, só a listagem 404) | AC-3 | 1 | — | não se aplica |
| 3 | Gates locais + verificação (cadastrar serviço → propaga) + ROADMAP/STATE | todos | 2a | gates individuais (ver nota em tasks.md do E01-S73 — `ci:local` só filtra em push real) | done |

**Achado extra (fora do plano original, necessário pra AC-2 funcionar de verdade):** o teste de
contrato revelou que `POST /services` devolve `result.id` como GUID string, não número — o
extrator padrão de `pcm-auvo-push` só aceita `number`. Sem corrigir isso, `writeEnabled:true`
teria feito toda criação de serviço falhar com "Auvo criou servicos sem id na resposta" mesmo com
o POST tendo funcionado. Corrigido: `extractCreatedAuvoId` customizado em `servicos.ts` +
`extractCreatedAuvoId`/`auvoId` ampliados de `number` pra `number | string` em `types.ts` e
`pcm-auvo-push/index.ts`. Teste de regressão novo em `pcm-auvo-push/index.test.ts`.

## Plano de teste
- Manual: `POST /services` real (task 1) — decidiu o caminho (AC-2). Resultado completo no `spec.md`.
- `pcm-auvo-push/index.test.ts`: teste novo cobrindo `extractCreatedAuvoId` com id string (regressão
  do bug real encontrado).
- `servicos.test.ts`: `writeEnabled: true`, `extractCreatedAuvoId` aceita GUID e devolve `null` sem
  `result.id`.
- Verificação em produção (cadastrar serviço → conferir `auvo_id` gravado): **não realizada nesta
  sessão** — próxima criação de serviço real no PCM valida ponta a ponta.

## Divergências (SPEC_DEVIATION)
- [x] Task 2b (banner de bloqueio) não se aplica — a spec previa dois caminhos mutuamente
  exclusivos (escrita aceita OU 404), mas a realidade é um terceiro caso: escrita aceita, listagem
  404. Como o push nunca usa a listagem, isso não bloqueia nada — documentado no `spec.md`.

## Checklist de Definition of Done
- [x] Resultado da task 1 documentado no `spec.md` (seção "Achado técnico — AC-1")
- [x] AC-1/AC-2 atendidos (AC-3 não se aplica) · gates Node locais verdes · ROADMAP/STATE
  atualizados
- [ ] `deno test` verde no CI (não executado localmente, sem Deno CLI)
- [ ] Verificação end-to-end em produção (cadastrar serviço real, conferir `auvo_id`) — pendente,
  requer deploy
