---
name: domain
description: Anti-Corruption Layer PCM ↔ Auvo — porta, eventos e relação entre contextos.
alwaysApply: false
---

# Domain Model (DDD) — Integração Auvo: Fundação

> Responde: qual a **linguagem** e o **modelo** do negócio. Este story não cria um bounded
> context novo — o Auvo continua modelado como *Conformist* dentro do PCM (ver
> `docs/ARCHITECTURE.md`). O que é novo aqui é a **Anti-Corruption Layer (ACL)** que traduz o
> modelo do Auvo (task, customer) para a linguagem do PCM (OS, cliente) sem vazar tipos do Auvo
> para o domínio.

## Bounded Context
**PCM / Operação** (`pcm`) — subdomínio **core**. O Auvo em si é `generic` (comprado pronto,
não é vantagem competitiva da Sinérgica); a integração com ele é parte do core porque decide
*quando* e *o quê* despachar.

## Linguagem ubíqua
> Termos já existentes em `docs/glossary.md` (não redefinir, só referenciar): **Auvo**, **Auvo
> Task**, **externalId**, **Ordem de Serviço (OS)**. Termo novo introduzido por este story:

| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **Porta Auvo** (`AuvoGatewayPort`) | Interface na camada `application` da feature PCM que abstrai o Auvo — a `domain` nunca importa cliente HTTP nem tipos do Auvo. Implementada por um adapter em `infrastructure`. | Cliente HTTP Auvo (implementação concreta, fica em `infrastructure`) |
| **Cliente Auvo (espelho)** | Registro do Auvo (`customerId`) vinculado 1:1 a `pcm.clientes` via `auvo_id`. É um **espelho**, não uma cópia de domínio — o PCM não modela endereço/contato do jeito do Auvo, só guarda o ID. | Condomínio (entidade de negócio no PCM) |
| **Sync de Cliente** | Ato de criar/atualizar o Cliente Auvo (espelho) a partir de `pcm.clientes`, disparado por evento de domínio, idempotente por `auvo_id`/`externalId`. | Sync de Técnico (`E01-S11`, direção oposta: Auvo → PCM) |

## Agregados, entidades e value objects
Este story **não cria agregado novo** — estende o agregado já existente `Ordem de Serviço` (raiz:
`OS`, contexto `pcm`) e a entidade `Cliente` (`pcm.clientes`) com comportamento de sincronização.

- **Agregado `Ordem de Serviço`** (raiz: `OS`, já existente)
  - Novo invariante: uma OS só pode transicionar para `planejamento` **depois** que o cliente
    dono da OS tem `auvo_id` preenchido (sync de cliente é pré-condição da criação de task —
    força a ordem correta sem acoplar a OS ao Auvo diretamente).
  - Novo value object: `AuvoSyncStatus` (`pending | synced | failed | in_conflict`) — já existe
    como coluna (`pcm.ordens_servico.auvo_sync_status`), formalizado aqui como VO com transições
    válidas: `pending → synced`, `pending → failed`, `failed → pending` (retry), `synced →
    in_conflict` (reconciliação futura, fora do escopo deste story).
  - Fronteira de consistência: a transição de status da OS (`solicitacao → planejamento`) e a
    gravação de `auvo_sync_status = pending` acontecem na mesma transação; a chamada HTTP ao
    Auvo acontece **fora** dela (é I/O externo — nunca dentro de uma transação de banco).

## Eventos de domínio
| Evento (passado)        | Disparado quando                                   | Quem reage                          |
|--------------------------|-----------------------------------------------------|--------------------------------------|
| `ClienteSincronizadoComAuvo` | Cliente PCM ganha/atualiza `auvo_id` com sucesso | Nada neste story (log/observabilidade) |
| `OSEntrouEmPlanejamento`  | OS muda de status para `planejamento` (já existe como transição de estado, formalizado como evento aqui) | Edge Function `pcm-auvo-create-task` (reage criando a task) |
| `TaskAuvoCriada`          | Auvo confirma criação da task, retorna `auvo_task_id` | Grava `auvo_task_id`, `auvo_sync_status = synced`, `auvo_synced_at` na OS |
| `SincronizacaoComAuvoFalhou` | Chamada ao Auvo (cliente ou task) falha após esgotar retries | Grava `auvo_sync_status = failed`, `auvo_sync_error`; alimenta fila de retry (`design.md`) |

## Relações com outros contextos
- **PCM → Auvo: Conformist via Anti-Corruption Layer.** O PCM não tenta influenciar o modelo de
  dados do Auvo (é um sistema externo comprado pronto) — a ACL (`AuvoGatewayPort` +
  `infrastructure/auvo/`) traduz nos dois sentidos e isola o resto do PCM do formato de resposta
  do Auvo (paginação, enums numéricos como `taskTypeId`, `paramFilter` JSON-encoded etc.).
- Já documentado em `docs/ARCHITECTURE.md` ("Integração Auvo — divisão de trabalho") e
  `docs/adr/0001-pcm-origin-truth-externalid.md` — este domain.md formaliza a tradução tática
  (porta + eventos), não introduz uma relação nova de context-map.
