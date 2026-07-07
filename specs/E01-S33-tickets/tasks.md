---
name: tasks
description: Decomposição e gates — CRUD (parcial) de Tickets, webhook em tempo real.
alwaysApply: false
---

# Tasks — Tickets

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S33_tickets.sql`: tabela `pcm.tickets` (`id uuid`, `titulo text not null`, `descricao text`, `cliente_id uuid references pcm.clientes`, `equipe_id uuid references pcm.equipes`, `responsavel_auvo_user_id bigint`, `prioridade int`, `request_type_id int`, `status_id int`, `auvo_id bigint unique`, colunas de sync + auditoria), RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('tickets')` | AC-1, AC-2, AC-3, AC-6 | E01-S22, E01-S27, E01-S32 mergeadas | `supabase test db` | todo |
| 2  | Descriptor `registry/tickets.ts` (`auvoBasePath:'/tickets'`, `webhookEntity:62`, `deleteStrategy:'unsupported'`, `writeEnabled:false`; **`toAuvo` de update só emite `statusId`** — não incluir título/descrição no patch, mesmo que existam no payload de origem) | AC-1, AC-2, AC-3, AC-4 | 1 | teste Deno do descriptor (update só contém `statusId`) | todo |
| 3  | Edge Function/hook de leitura para `GET /tickets/request-type` e `GET /tickets/status` (chamada direta, TTL curto ou sem cache — decidir na implementação; não é um descriptor do registry) | AC-5 | — | teste de integração Deno | todo |
| 4  | Domínio/application/infrastructure/páginas: formulário de novo Ticket (resolve `customerId`/`teamId`/`userResponsableId` a partir das entidades já sincronizadas), tela de listagem/mudança de status | AC-1, AC-2, AC-3, AC-5, AC-6 | 2, 3 | `vitest` + manual | todo |
| 5  | Wiring em `HomePage.tsx`: item "Tickets" em OPERAÇÃO | AC-6 | 4 | `pnpm run build` | todo |
| 6  | Refatorar o dispatcher de webhook (`E01-S23`) para incluir Ticket como caso real de `byWebhookEntity` | AC-4 | 2, E01-S23 mergeada | teste de regressão | todo |
| 7  | pgTAP `supabase/tests/tickets_rls.test.sql` | AC-6 | 1 | `supabase test db` | todo |
| 8  | Rodar `pnpm run ci:local` | todos | 1–7 | `pnpm run ci:local` | todo |
| 9  | Atualizar ROADMAP/STATE | — | 8 | revisão humana | todo |

## Plano de teste
- Unidade: domínio, descriptor (`toAuvo` de update restrito a `statusId`).
- Integração Deno: leitura das listas de referência (task 3).
- pgTAP: RLS.
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] O contrato `AuvoEntityDescriptor` só tinha `toAuvo()` único (mesmo payload para POST e PATCH)
      — insuficiente para Tickets, cujo PATCH só documenta `statusId`. Adicionado campo aditivo
      opcional `toAuvoUpdate?(row)`: se presente, `pcm-auvo-push` usa esse payload restrito no
      PATCH em vez de `toAuvo()` completo; ausente (todas as outras entidades) mantém o
      comportamento anterior sem mudança. Mesmo padrão dos aditivos anteriores
      (`deleteStrategy`/`deactivatePatch`/`supportsUpdate`/`externalIdField`).
- [x] `customerId`/`teamId` do `POST /tickets/` exigem `pcm.clientes.auvo_id`/`pcm.equipes.auvo_id`,
      mas `toAuvo()` é função pura sem acesso a banco (não pode fazer join). Resolvido com o mesmo
      padrão de `pcm.cliente_grupos.clientes_auvo_ids` (E01-S27): `pcm.tickets` ganhou
      `cliente_auvo_id`/`equipe_auvo_id` denormalizados, populados pela `application`/adapter no
      momento de criar/editar o ticket (resolve o id local → auvo_id antes de gravar).
- [x] `requesterEmail`/`requesterName` do `POST /tickets/` (documentados na spec da API) não têm
      campo correspondente no formulário desta leva — a spec.md (AC-1) só pede título/cliente/tipo/
      prioridade; ficam de fora do `toAuvo()` até haver decisão de produto sobre capturá-los.

## Checklist de Definition of Done
- [x] AC-1 a AC-6 implementados em código local
- [ ] Todos os AC (AC-1 a AC-6) verdes pelo gate executável completo (Deno/pgTAP/browser)
- [x] Confirmado que `toAuvoUpdate` do descriptor de Tickets só emite `statusId` (teste Deno
      `tickets.test.ts` + teste Node `pcm-auvo-push/index.test.ts` cobrindo `toAuvoUpdate` genérico)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde completo; localmente ficaram verdes os gates Node (lint:migrations,
      lint, typecheck, test 164 pass/9 skip, build, arch:check, audit:esteira, eval:spec); Deno
      CLI/Docker ausentes neste ambiente — testes Deno/pgTAP escritos, não executados; teste manual
      em browser não executado
