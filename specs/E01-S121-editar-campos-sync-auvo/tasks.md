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
| 1 | Confirmar na doc Auvo v2 quais campos de task são editáveis via API; registrar no spec (contexto) | AC-1,AC-3 | revisão | **feito (2026-08-06)** — doc oficial (`auvoapiv2.docs.apiary.io`) confirma `PATCH /tasks/{id}` (JSONPatchDocument) e `PUT /tasks/` (upsert); ver "Contrato Auvo confirmado" abaixo |
| 2 | Domínio: `camposEditaveisOs` (whitelist) + validação; identidade (cliente/local/numero) fora | AC-3 | vitest | pendente |
| 3 | Application/adapter: `atualizarOrdemServico` grava PCM e enfileira update no outbox quando `auvoTaskId != null` | AC-1,AC-2 | typecheck | pendente |
| 4 | Edge/push: `pcm-auvo-push` trata evento de update de task (idempotente, atualiza task existente via `PATCH /tasks/{id}`) | AC-2 | (deno CI) | pendente |
| 5 | UI `DetalheOs`: modo editar libera só os campos da whitelist; identidade read-only; erro detalhado + estado "sync pendente" no fail | AC-1,AC-3,AC-4 | typecheck | pendente |
| 6 | Testes: falha de sync não perde edição PCM (AC-4) | AC-4 | vitest | pendente |

## Contrato Auvo confirmado (2026-08-06)
Fonte: `https://auvoapiv2.docs.apiary.io/#` (doc oficial, trazida pelo Lucas).

- **`PATCH /tasks/{id}`** — atualização parcial via `JSONPatchDocument`: `[{ "op": "replace", "path": "orientation", "value": "..." }]`. Campos aceitos: `taskType`, `externalId`, `idUserFrom`, `idUserTo`, `teamId`, `taskDate` (`yyyy-MM-ddTHH:mm:ss`), `latitude`, `longitude`, `address`, `orientation`, `priority` (1 Low/2 Medium/3 High), `questionnaireId`, `customerId`, `checkinType`, `keyWords`, `sendSatisfactionSurvey`, `sendDigitalOs`, `financialCategory`, `financialCategoryId`. Resposta 200 com a Task atualizada.
- **`PUT /tasks/`** — upsert por `id` ou `externalId` (mesmos campos + `listIdUserTo`); 200 se atualizou, 201 se criou. Preferir `PATCH /tasks/{id}` aqui (edição de task já existente, `taskID` conhecido) — upsert por `externalId` arrisca criar task nova se o id divergir.
- **Task não tem campo "título"** — só `orientation` (texto livre, até 5000 caracteres) e `taskTypeDescription` (derivado do `taskType`, categoria, não texto livre). A proposta original do spec ("título/orientação") precisa reconciliar: "título" da OS no PCM não tem campo Auvo equivalente — mapear pra `orientation` (mesmo uso já feito em `pcm-auvo-open-task`, que envia `orientation: os.descricao ?? os.titulo`) ou tratar como campo só-PCM (não sincroniza).
- Campos editáveis confirmados pro whitelist da task 2: `orientation`, `taskDate`, `idUserTo` (técnico), `priority`. `título` fica pendente da decisão acima antes de entrar na whitelist.

## Divergência a resolver antes da task 2
- [ ] SPEC_DEVIATION a registrar: "título" proposto no spec original não mapeia pra nenhum campo Auvo — decidir entre (a) editar só PCM sem sync (não é campo Auvo) ou (b) tratar como alias de `orientation` no PATCH (mesmo padrão de `pcm-auvo-open-task`).

## Plano de teste
- Unidade: whitelist de campos; enfileiramento condicional (`auvoTaskId` null → não enfileira).
- Aceite: Playwright — editar título de OS com task, salvar, ver persistência; simular indisponível → edição fica, badge "sync pendente".
- Deno: teste do handler de update no push (não roda local, sem Deno CLI — validar no CI).

## Divergências (SPEC_DEVIATION)
- [ ] Se a API Auvo não aceitar algum campo da proposta, remover do modal e anotar aqui.

## Bloqueio de descoberta — RESOLVIDO (2026-08-06)
- Bloqueado desde 2026-08-05 (buscas web não achavam a doc oficial). Lucas trouxe o link direto
  (`https://auvoapiv2.docs.apiary.io/#`) e o contrato foi confirmado — ver "Contrato Auvo
  confirmado" acima. `pcm-auvo-push` ainda não tem descriptor de `ordens_servico`/`tasks` no
  registry (task 4 cobre isso).

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [x] Campos editáveis confirmados contra a doc Auvo (2026-08-06)
- [ ] ROADMAP.md + STATE.md atualizados
