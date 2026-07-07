---
name: spec
description: Contrato — motor de sync PCM→Auvo (outbox transacional + drain genérico).
alwaysApply: true
---

# Spec — Motor de sync Auvo (write path)

> **Fonte da verdade.** Status: aprovado
> Ver `product.md` (por quê) e `design.md` (como). Este contrato cobre só o sentido PCM→Auvo
> (outbox + drain). O sentido Auvo→PCM (webhook dispatcher + poller) é `E01-S23`.

## Resumo
O sistema passa a ter um mecanismo genérico (`pcm.auvo_sync_outbox` + Edge Function
`pcm-auvo-push`) que qualquer tabela `pcm.*` registrada no *entity registry* usa para propagar
suas escritas (create/update/soft-delete) ao Auvo, com idempotência por `externalId`, retry em
falha e sem nunca bloquear a transação de origem no PCM.

## Critérios de aceite

### AC-1: Escrita numa tabela registrada enfileira no outbox
- **Dado** uma tabela `pcm.<x>` com o trigger `pcm.fn_auvo_enqueue('<x>')` anexado
- **Quando** uma linha é inserida, atualizada, ou tem `deleted_at` preenchido (soft-delete) por um
  usuário `authenticated` (não pelo sentinela Auvo)
- **Então** uma linha aparece em `pcm.auvo_sync_outbox` com `entity='<x>'`, `row_id` = id da linha,
  `op` correto (`create`/`update`/`delete`), `status='pending'`

### AC-2: Escrita originada do sentinela Auvo NÃO enfileira (anti-loop)
- **Dado** a mesma tabela registrada
- **Quando** uma linha é atualizada com `updated_by = auvo_system_user_id` (sentinela)
- **Então** nenhuma linha nova aparece em `pcm.auvo_sync_outbox`

### AC-3: Drain processa um lote pendente e chama o Auvo com idempotência
- **Dado** N linhas `pending` no outbox para um descriptor com `writeEnabled=true`
- **Quando** `pcm-auvo-push` é invocada (via `service_role`)
- **Então** cada linha é processada no máximo uma vez por invocação (`FOR UPDATE SKIP LOCKED`),
  o Auvo é chamado com `externalId = row_id` (create) ou `PATCH`/`PUT` (update), a linha de origem
  recebe `auvo_id`/`auvo_sync_status='synced'`/`auvo_synced_at` gravados com `updated_by =
  auvo_system_user_id`, e a linha do outbox vira `status='sent'`, `sent_at` preenchido

### AC-4: Reprocessar a mesma linha do outbox não duplica no Auvo
- **Dado** uma linha de origem que já tem `auvo_id` preenchido (sincronizada antes)
- **Quando** o drain processa uma nova entrada de outbox `op='update'` para essa mesma linha
- **Então** o Auvo recebe `PUT`/`PATCH` (nunca um novo `POST` de criação) — checagem por
  `auvo_id` já presente, sem nova busca por `externalId`

### AC-5: Falha na chamada Auvo não trava o lote nem perde a linha
- **Dado** uma linha `pending` cuja chamada ao Auvo falha (erro de rede, 5xx, ou rate limit
  esgotado após os retries do `client.ts`)
- **Quando** o drain processa essa linha
- **Então** a linha do outbox vira `status='error'`, `attempts` incrementado, `last_error`
  preenchido (truncado, sem stack trace), e as demais linhas do lote continuam sendo processadas
  normalmente (uma falha não aborta o lote inteiro)

### AC-6: Descriptor com `writeEnabled=false` nunca chama a API Auvo
- **Dado** um descriptor registrado com `writeEnabled=false`
- **Quando** o drain encontra uma linha `pending` para esse `entity`
- **Então** nenhuma chamada HTTP é feita ao Auvo; a linha do outbox é marcada de forma que fique
  claro que foi pulada por dry-run (não confundir com falha real — usar `last_error` com mensagem
  explícita tipo `"writeEnabled=false, pulado"`)

### AC-7: Outbox é infraestrutura pura — nenhum acesso da UI
- **Dado** a tabela `pcm.auvo_sync_outbox` com RLS FORCE
- **Quando** um usuário `authenticated` (qualquer papel) tenta `SELECT`/`INSERT`/`UPDATE`/`DELETE`
  diretamente
- **Então** a operação é negada (só `service_role` tem GRANT)

## Casos de borda e erros
- Duas invocações concorrentes do drain (cron dispara antes da anterior terminar): nenhuma linha
  é processada duas vezes (`FOR UPDATE SKIP LOCKED` garante exclusão mútua por linha).
- Linha de origem foi deletada fisicamente entre o enqueue e o drain (não deveria acontecer, já
  que o padrão do projeto é soft-delete, mas o drain deve tolerar `SELECT` vazio e marcar a linha
  do outbox como `error` com mensagem clara, sem lançar exceção não tratada).
- `auvo_id` já existente na linha de origem no momento do `op='create'` (corrida entre duas
  fontes de escrita): tratar como `update`, nunca criar duplicata no Auvo.
- Descriptor desconhecido (`entity` no outbox sem correspondente no registry — não deveria
  acontecer se o enqueue só roda com trigger corretamente parametrizado, mas o drain deve marcar
  `error` em vez de lançar).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Qualquer descriptor concreto de entidade (Funcionários, Ferramentas, Serviços, Equipamentos,
  Categorias, Equipes, Segmentos, Tipos de Tarefa, Tickets, Clientes-CRUD) — entram em
  `E01-S24`+.
- Dispatcher de webhook genérico e poller `pcm-auvo-pull` (sentido Auvo→PCM) — `E01-S23`.
- `auvoDelete`/hard-delete real no Auvo — implementado no cliente HTTP por completude, mas
  nenhum fluxo desta story o invoca.
- Alertas automáticos para linhas `error` acumuladas — reconciliação manual nesta fase.
- Alterar os 2 fluxos síncronos já existentes (`pcm-auvo-customers-sync`, `pcm-auvo-create-task`).

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` · Domínio: `./domain.md`
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`,
  `docs/adr/0005-outbox-sync-auvo.md` (a criar na task 1)
