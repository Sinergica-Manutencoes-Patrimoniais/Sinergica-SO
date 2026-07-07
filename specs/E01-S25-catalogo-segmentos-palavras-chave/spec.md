---
name: spec
description: Contrato — CRUD de Segmentos e Palavras-chave no PCM, sincronizado com Auvo /segments e /keywords (cron, sem webhook).
alwaysApply: true
---

# Spec — Segmentos + Palavras-chave (catálogos simples)

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno
> Bundla 2 entidades quase idênticas (um único campo `description`) para não abrir 2 stories
> triviais separadas — mesmo padrão do motor já validado em `E01-S24`. Endpoints: `/segments`,
> `/keywords`. Sem webhook em nenhuma das duas.

## Resumo
O Fabrício cadastra/edita/exclui Segmentos (classificação de cliente, ex. "Condomínio
Residencial") e Palavras-chave (tags de busca) no PCM; o motor propaga para `/segments`/
`/keywords` no Auvo e traz de volta mudanças feitas lá via poller diário.

## Contexto específico (ler antes de implementar)
- Ambos os endpoints: `GET`/`POST`/`PATCH`/`DELETE` por `id` (bigint), corpo só com
  `description` (string, até 1000 chars nos dois). **Sem `externalId`** — mesma ressalva de
  idempotência de `E01-S24` (match-by-description-exato antes de criar).
- `PATCH` é JSON Patch.
- Cadência de poller: diária (catálogo estático).

## Critérios de aceite
> AC numerados uma vez, aplicam-se às DUAS entidades (Segmento e Palavra-chave) — cada teste de
> aceite roda 2x, uma por entidade.

### AC-1: Criar propaga ao Auvo
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cria um Segmento/Palavra-chave com
  `descricao` preenchida
- **Quando** salva
- **Então** a linha é criada em `pcm.segmentos`/`pcm.palavras_chave`, o outbox enfileira, e o
  drain cria no Auvo, gravando `auvo_id`

### AC-2: Editar propaga como PATCH
- **Dado** um registro já sincronizado
- **Quando** o usuário edita a descrição
- **Então** o drain envia `PATCH` (JSON Patch), nunca um novo `POST`

### AC-3: Excluir é soft-delete → sem contraparte de "active" no Auvo (ver Casos de borda)
- **Dado** um registro sincronizado
- **Quando** o usuário exclui
- **Então** `deleted_at` é preenchido no PCM; a chamada ao Auvo é `DELETE /segments/{id}` ou
  `DELETE /keywords/{id}` (não `PATCH active:false` — **estas 2 entidades não têm campo `active`
  documentado**, então o soft-delete padrão do motor não se aplica 1:1 aqui, ver Casos de borda)

### AC-4: Mudança no Auvo chega ao PCM via poller diário
- **Dado** um Segmento/Palavra-chave criado ou editado no Auvo
- **Quando** o poller diário roda
- **Então** o PCM é atualizado por upsert `auvo_id`, sem re-enfileirar

### AC-5: Telas com gate de permissão
- **Dado** um usuário sem `podeAcessar('pcm','escrita')`
- **Quando** acessa "Segmentos" ou "Palavras-chave" (CADASTROS)
- **Então** vê a listagem mas não os controles de escrita

### AC-6: RLS FORCE + módulo `pcm`
- Mesma regra de `E01-S24` AC-6, para `pcm.segmentos` e `pcm.palavras_chave`.

## Casos de borda e erros
- **Sem campo `active` em Segments/Keywords**: diferente do padrão geral do motor (soft-delete
  PCM → `PATCH active:false` no Auvo), estas 2 entidades não têm esse campo — a única forma de
  "desativar" no Auvo é o `DELETE` físico. **Decisão desta story**: o descriptor sinaliza (via um
  campo novo no `AuvoEntityDescriptor`, ex. `deleteStrategy: 'soft-patch' | 'hard-delete'`, a
  adicionar em `registry/types.ts`) que a exclusão PCM→Auvo para estas 2 entidades usa
  `auvoDelete` de verdade, não `auvoPatch`. Isso é aceitável aqui porque Segmento/Palavra-chave
  são metadados de classificação — perder o registro no Auvo (sem histórico de "estava
  desativado") tem risco baixo, diferente de um Cliente ou Equipamento. **Registrar essa extensão
  do contrato do registry como parte desta story, não retroativamente em `E01-S22`.**
- Mesma ressalva de idempotência sem `externalId` de `E01-S24` (match-by-description-exato).
- Descrição duplicada: permitido, sem unicidade de negócio conhecida.

## Fora de escopo
- Qualquer relação entre Segmento/Palavra-chave e Cliente/Task (a API Auvo não documenta um
  vínculo direto consultável para estes 2 recursos neste catálogo).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
- Story irmã (mesmo padrão): `../E01-S24-catalogo-tipos-tarefa/spec.md`
