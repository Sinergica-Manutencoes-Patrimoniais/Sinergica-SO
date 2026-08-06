---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Editar campos da OS e re-sincronizar com o Auvo

> Tier pequeno. Provável migration só se o outbox precisar de um tipo de evento "update_task"
> (verificar o schema do outbox atual antes — pode já suportar). Confirmar campos editáveis contra
> a doc Auvo v2 (`PUT /tasks`) **antes** de expor no modal.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Confirmar na doc Auvo v2 quais campos de task são editáveis via API; registrar no spec (contexto) | AC-1,AC-3 | revisão | **blocked externo** — não há doc oficial pública nem exemplo autenticado disponível |
| 2 | Domínio: `camposEditaveisOs` (whitelist) + validação; identidade (cliente/local/numero) fora | AC-3 | vitest | **blocked por 1** — a whitelist não pode ser inferida |
| 3 | Application/adapter: `atualizarOrdemServico` grava PCM e enfileira update no outbox quando `auvoTaskId != null` | AC-1,AC-2 | typecheck | **blocked por 1** — tipo/payload do evento depende do contrato |
| 4 | Edge/push: `pcm-auvo-push` trata evento de update de task (idempotente, atualiza task existente) | AC-2 | (deno CI) | **blocked por 1** — endpoint e body não verificados |
| 5 | UI `DetalheOs`: modo editar libera só os campos da whitelist; identidade read-only; erro detalhado + estado "sync pendente" no fail | AC-1,AC-3,AC-4 | typecheck | **blocked por 1** — a edição PCM herdada de E01-S69 não satisfaz sync Auvo |
| 6 | Testes: falha de sync não perde edição PCM (AC-4) | AC-4 | vitest | **blocked por 3–4** |

## Plano de teste
- Unidade: whitelist de campos; enfileiramento condicional (`auvoTaskId` null → não enfileira).
- Aceite: Playwright — editar título de OS com task, salvar, ver persistência; simular indisponível → edição fica, badge "sync pendente".
- Deno: teste do handler de update no push (não roda local, sem Deno CLI — validar no CI).

## Divergências (SPEC_DEVIATION)
- [ ] Se a API Auvo não aceitar algum campo da proposta, remover do modal e anotar aqui.

## Bloqueio de descoberta (2026-08-05)
- A busca pela documentação oficial pública do Auvo não retornou a referência de atualização de
  tarefas. No código, `pcm-auvo-push` só processa entidades declaradas no registry e não há
  descriptor para `ordens_servico`/`tasks`; portanto não existe payload ou endpoint verificado
  para implementar o `PUT` sem adivinhação. Retomar quando houver acesso à documentação oficial
  ou um exemplo autenticado de request/response do Auvo.
- Em 2026-08-06, nova busca web por `Auvo API v2 PUT tasks` e domínios Auvo tampouco trouxe fonte
  oficial. A UI de edição PCM já existe por E01-S69, mas não é marcada como entrega desta story:
  sem a confirmação, ela não pode prometer campos compatíveis nem o estado de sincronização Auvo.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] Campos editáveis confirmados contra a doc Auvo (**bloqueio externo**)
- [ ] ROADMAP.md + STATE.md atualizados
