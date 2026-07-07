---
name: spec
description: Contrato — CRUD de Serviços no PCM, sincronizado com Auvo /services (cron, sem webhook, id GUID, idempotência por externalCode).
alwaysApply: true
---

# Spec — Serviços

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno
> Endpoint: `/services`. Sem webhook — `Service` não está entre as 6 entidades. **Duas
> diferenças importantes em relação a todo o resto do catálogo já especificado**, ver Contexto.

## Resumo
Serviços (mão de obra faturável, ex. "Instalação de Split 12000 BTU") ganham CRUD no PCM,
sincronizado com `/services`.

## Contexto específico (ler antes de implementar) — IMPORTANTE
- **`id` de Service é GUID (string), não bigint.** Todo o resto do catálogo mapeado até aqui usa
  `id` numérico. `pcm.servicos.auvo_id` deve ser `text`, não `bigint` (única entidade com esse
  tipo). O motor genérico (`pcm-auvo-push`) já funciona com isso em runtime (JS não distingue
  tipo do id em tempo de execução), mas ao implementar, tipar `auvo_id: string | null` no lado
  TS/adapter em vez de `number | null` para não confundir quem ler o código depois.
- **Idempotência de criação usa `externalCode`, não `externalId`** — confirmado no catálogo
  (`POST`/`PUT /services/` usam `externalCode`, descrito como "must be unique"). O descriptor
  desta entidade DEVE setar `externalIdField: 'externalCode'` (campo aditivo já disponível em
  `AuvoEntityDescriptor` desde a correção feita ao mapear esta story — ver
  `E01-S22/design.md` → Riscos).
- Corpo: `title`, `price`, `active`, `description`, `externalCode`, `fiscalServiceId`. `PATCH` é
  JSON Patch. `active` existe (soft-patch padrão).
- Cadência de poller: a cada 6h (mesmo grupo de Ferramentas/Equipes — catálogo com alguma
  mudança, sem webhook).
- **Endpoint legado** `GET /services/obterListaServicos` (sem paginação) existe mas não deve ser
  usado pelo poller — usar sempre a listagem paginada padrão.

## Critérios de aceite

### AC-1: Criar Serviço propaga ao Auvo com idempotência por `externalCode`
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cadastra um Serviço (título, preço)
- **Quando** salva
- **Então** `pcm.servicos` ganha a linha, o outbox enfileira, o drain cria em `/services/` com
  `externalCode = row.id` (não `externalId`), grava `auvo_id` (string/GUID)

### AC-2: Editar propaga como PATCH
- Mesmo padrão geral.

### AC-3: Excluir é soft-delete → `PATCH active:false`
- Mesmo padrão geral (Services tem `active`).

### AC-4: Mudança no Auvo chega ao PCM via poller a cada 6h
- Mesmo padrão de `E01-S30` AC-4.

### AC-5: Preço em centavos inteiros, nunca float
- **Dado** o campo `price` do Serviço
- **Quando** armazenado no PCM (`pcm.servicos.preco_centavos int`) e enviado ao Auvo
  (`price`, que o Auvo espera em decimal — converter na borda, nunca guardar float no PCM)
- **Então** segue `docs/adr/0001-dinheiro-em-centavos.md` (centavos inteiros no domínio,
  conversão reais↔centavos só na borda de I/O)

### AC-6: Tela com gate de permissão + RLS FORCE
- Mesmo padrão das demais entidades.

## Casos de borda e erros
- `price` negativo ou zero: validar no domínio antes de qualquer chamada.
- `fiscalServiceId` (GUID de serviço fiscal): fora de escopo desta leva (não há cadastro de
  serviço fiscal no PCM) — sempre `null`.

## Fora de escopo
- `fiscalServiceId`/integração fiscal.
- Endpoint legado `obterListaServicos`.

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}` (achado
  `externalCode`/GUID documentado ali)
