---
name: tasks
description: Decomposição e gates da fundação de integração Auvo. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Fundação

> Decomposição da implementação. Nenhuma task foi executada ainda — este story é resultado de
> **estudo e planejamento** (instrução explícita do usuário: "gere as specs para desenvolver na
> sequência"), não de implementação. `@dev` retoma a partir daqui em sessão futura.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Confirmar com Fabrício `taskTypeId` de `levantamento`/`emergencial` e mapeamento `prioridade` GUT → `priority` Auvo (Questões em aberto do `design.md`) | AC-7 | — | resposta registrada em `design.md` (remove a questão em aberto) | todo |
| 2  | `supabase secrets set AUVO_API_KEY AUVO_API_TOKEN` em produção (hoje só em `.env.local`) | — | — | `supabase secrets list` mostra as 2 chaves | todo |
| 3  | Cliente HTTP Auvo compartilhado (`supabase/functions/_shared/auvo/client.ts`): login cacheado, retry 401, backoff 429 | AC-1 a AC-6 | — | teste unitário do cache/retry | todo |
| 4  | `task-type-map.ts` (categoria → `taskTypeId`) `[P]` | AC-4, AC-7 | 1 | teste unitário do mapeamento | todo |
| 5  | Port `AuvoGatewayPort` na `application` da feature PCM (`syncCustomer`, `createTask`) | AC-1 a AC-7 | — | teste do caso de uso com fake do port | todo |
| 6  | Edge Function `pcm-auvo-customers-sync` (busca por `externalId`, cria ou vincula) | AC-1, AC-2, AC-3 | 3 | teste de integração com mock HTTP do Auvo | todo |
| 7  | Edge Function `pcm-auvo-create-task` (busca por `externalId`, cria, grava colunas de sync) | AC-4, AC-5, AC-7 | 3, 4, 6 | teste de integração com mock HTTP do Auvo | todo |
| 8  | Trigger `pg_net` assíncrono em `pcm.ordens_servico` (dispara `pcm-auvo-create-task` no `UPDATE` para `planejamento`) — nova migration `000N_E01-S09_trigger_auvo_planejamento.sql` | AC-4, AC-6 | 7 | `pnpm run lint:migrations` limpo + teste manual de trigger (pgTAP ou script) | todo |
| 9  | Tratamento de erro/`failed` não propagado ao usuário (AC-6) — garantir que o `UPDATE` de status da OS nunca espera a Edge Function | AC-6 | 8 | teste de integração: Auvo mockado como indisponível, `UPDATE` da OS ainda retorna sucesso | todo |
| 10 | Observabilidade: log estruturado com `X-Request-Id` + timestamp UTC em toda chamada Auvo `[P]` | — | 3 | inspeção de log em teste de integração | todo |
| 11 | Feature flag `NullAuvoGateway` (no-op) em `config/env.ts`, para desligar a integração sem revert `[P]` | — | 5 | teste: flag off → nenhuma chamada HTTP sai | todo |
| 12 | Atualizar `docs/blueprint/integracoes/auvo.md` e `docs/ARCHITECTURE.md` se a implementação divergir do design (não deveria, mas confirmar) | — | 3-11 | `diff` conceitual design ↔ código | todo |
| 13 | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S09` como implementado, AC verdes | — | 1-12 | inspeção | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção").

## Plano de teste
- Unidade: `task-type-map.ts` (categoria → ID, categoria sem mapeamento retorna erro
  tipado); cache/retry do cliente HTTP (token expira, 401 força novo login).
- Integração: `pcm-auvo-customers-sync` e `pcm-auvo-create-task` contra mock HTTP do Auvo (a
  decidir na task 3/6: `msw` ou stub de `fetch` — verificar se já há padrão no repo antes de
  introduzir dependência nova).
- Aceite: um teste por AC desta spec (AC-1 a AC-7) — idealmente teste de integração real da
  Edge Function via `supabase functions serve` local, ou teste E2E se o projeto já tiver esse
  runner (ver `testes/README.md`).

## Divergências (SPEC_DEVIATION)
- Nenhuma — este story ainda não foi implementado, só planejado (spec/design/tasks). Divergências
  só existirão a partir da implementação real.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR novo se a implementação real tomar decisão irreversível não coberta pelo ADR-0001
      (avaliar na task 8 — trigger `pg_net` é candidato)
- [ ] Glossário atualizado se mudou (termos novos já adicionados em `domain.md`, promover ao
      `docs/glossary.md` global na implementação)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
- [ ] Segredos Auvo em Supabase Vault, nunca em código ou `.env` commitado
