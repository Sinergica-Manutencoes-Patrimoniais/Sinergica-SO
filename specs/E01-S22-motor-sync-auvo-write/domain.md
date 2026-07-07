---
name: domain
description: Generalização da Anti-Corruption Layer PCM↔Auvo — outbox, entity registry, sentinela anti-loop.
alwaysApply: false
---

# Domain Model (DDD) — Motor de sync Auvo

> Este story não cria um bounded context novo — generaliza a Anti-Corruption Layer já descrita em
> `specs/E01-S09-integracao-auvo-fundacao/domain.md` (lá, específica para Cliente/Task) para
> qualquer entidade futura. O Auvo continua `Conformist` dentro do PCM (`docs/ARCHITECTURE.md`).

## Bounded Context
**PCM / Operação** (`pcm`) — subdomínio **core**. O motor de sync em si é infraestrutura
(camada `infrastructure`, fora de `apps/web/src/features/pcm/`), mas as regras de idempotência e
anti-loop são decisão de domínio (ADR-0001, ADR-0005) — por isso registradas aqui.

## Linguagem ubíqua
| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **Descriptor** (`AuvoEntityDescriptor`) | Registro no *entity registry* que descreve como uma tabela `pcm.*` mapeia para um recurso Auvo: endpoint, coluna de `auvo_id`, `toAuvo`/`fromAuvo`, se é `webhookEntity` ou `cronSchedule`, e o gate `writeEnabled`. É a unidade de extensão do motor — uma entidade nova = um descriptor novo, não uma Edge Function nova. | Adapter de UI (`supabase-<entidade>-adapter.ts`, camada `application`/`infrastructure` da feature — mapeia domínio↔Postgres, não PCM↔Auvo) |
| **Outbox** (`pcm.auvo_sync_outbox`) | Fila transacional de propagação PCM→Auvo: uma linha por escrita pendente de sincronizar. Nunca é lida pela UI. | `pcm.auvo_task_snapshots` (espelho read-only Auvo→PCM, direção oposta) |
| **Drain** | Ato de a Edge Function `pcm-auvo-push` reivindicar um lote `pending` do outbox e tentar entregá-lo ao Auvo. | "Sync" genérico (termo usado ambiguamente antes; a partir daqui, "drain" é especificamente o consumo do outbox) |
| **Sentinela Auvo** (`auvo_system_user_id`) | Valor reservado de `updated_by` usado por qualquer escrita que se origina de dados vindos do Auvo (drain confirmando sucesso, dispatcher de webhook, poller de `E01-S23`). Existe só para o anti-loop — `fn_auvo_enqueue` não enfileira quando `NEW.updated_by` é o sentinela. | Usuário real do sistema (`config.usuarios`) — o sentinela nunca faz login, é só um marcador |
| **`writeEnabled`** | Flag por descriptor: `false` = o drain nunca chama a API Auvo para essa entidade (modo dry-run/pull-only), `true` = chamadas reais habilitadas. Existe porque os nomes de campo/formato do Auvo não estão verificados contra produção para a maioria dos recursos (ver `client.ts`, nota "NÃO VERIFICADO"). | Feature flag de produto (`config.feature_flags`) — este é um gate técnico interno do motor, não visível a usuário final |

## Agregados, entidades e value objects
Este story não introduz agregado de negócio novo — a única "entidade" é de infraestrutura:

- **Outbox Entry** (linha de `pcm.auvo_sync_outbox`) — não é um agregado DDD (não tem invariante
  de negócio, é um registro de trabalho pendente). Estados válidos: `pending → sent`,
  `pending → error → pending` (retry manual/automático), nunca `sent → pending` (entrega
  confirmada é terminal).
- **Generalização do VO `AuvoSyncStatus`** (`pending | synced | failed`, já existente em
  `pcm.ordens_servico` desde `E01-S09`): toda tabela nova registrada no motor ganha as mesmas 3
  colunas (`auvo_sync_status`, `auvo_synced_at`, `auvo_sync_error`) com a mesma semântica — não
  reinventar nome por entidade.

## Eventos de domínio
| Evento (passado) | Disparado quando | Quem reage |
|---|---|---|
| `EscritaPcmEnfileirada` | INSERT/UPDATE/soft-DELETE numa tabela registrada, com `updated_by` ≠ sentinela | `fn_auvo_enqueue` grava a linha no outbox |
| `DrainProcessouLote` | `pcm-auvo-push` reivindica e processa um lote `pending` | Cada linha vira `sent` (sucesso) ou `error` (falha, com `last_error`) |
| `EntidadeSincronizadaComAuvo` | Auvo confirma create/update, drain grava `auvo_id`/`auvo_sync_status='synced'` na linha de origem, com `updated_by=sentinela` | Nada neste story (log/observabilidade); `E01-S23` usa o mesmo sentinela no sentido inverso |
| `SincronizacaoComAuvoFalhouNoDrain` | Chamada Auvo falha (rede, 4xx≠idempotência, 5xx, rate limit esgotado) | Outbox grava `attempts++`, `status='error'`, `last_error` — reconciliação manual nesta fase (mesma dívida aceita em `E01-S09`) |

## Relações com outros contextos
Mesma relação já documentada em `E01-S09/domain.md` (PCM → Auvo: Conformist via ACL), agora
formalizada como **um único ponto de tradução por entidade** (o descriptor) em vez de lógica
espalhada em Edge Functions individuais. Não introduz relação nova de context-map.
