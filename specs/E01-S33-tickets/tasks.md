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
- [ ] (preencher durante a implementação se necessário)

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-6) verdes pelo gate executável
- [ ] Confirmado que `toAuvo` de update nunca tenta editar título/descrição via PATCH (só status)
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
