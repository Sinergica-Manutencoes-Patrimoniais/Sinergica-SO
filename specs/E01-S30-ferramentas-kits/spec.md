---
name: spec
description: Contrato — CRUD de Ferramentas/Kits (recurso "Products" do Auvo) no PCM + tela de alocação por técnico via employee-product-stock (cron, sem webhook).
alwaysApply: true
---

# Spec — Ferramentas/Kits + alocação por técnico

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno (CRUD) — a alocação por técnico é um
> fluxo à parte, ver Contexto específico
> Endpoint: `/products` (+ `/products/employee-product-stock`). Sem webhook — `Product` não está
> entre as 6 entidades. **Decisão do usuário**: este recurso não é "estoque financeiro" — é
> ferramentas/kits de técnico, o objetivo é saber **com qual técnico está cada ferramenta**.

## Resumo
Ferramentas e kits (furadeira, multímetro, kit de EPI, ...) ganham cadastro no PCM
(`pcm.ferramentas`), sincronizado com o recurso `/products` do Auvo, e uma tela de alocação que
mostra/edita **qual técnico está com qual ferramenta**, usando
`PUT /products/employee-product-stock`.

## Contexto específico (ler antes de implementar)
- `/products`: CRUD completo, `externalId` presente (idempotência real), `active` presente
  (soft-patch padrão), `categoryId` (referencia `pcm.produto_categorias`, `E01-S26`),
  `unitaryValue`/`unitaryCost`/`minimumStock`/`totalStock`. `PATCH` é JSON Patch.
- **`GET /products/{id}` já devolve `employeesStock: [{ userId, amount }]`** — a alocação por
  técnico é parte do próprio recurso Product no Auvo, não uma entidade separada.
- **`PUT /products/employee-product-stock`** (`{ userId, productId, amount }`) é uma ação, não um
  CRUD de recurso com `id` próprio — **não usa o descriptor genérico do registry** (que assume
  `POST`/`PATCH .../{id}` endereçável). Implementar como uma Edge Function/RPC dedicada, no
  padrão direto de `pcm-auvo-create-task` (trigger síncrono ou chamada explícita da UI), NÃO pelo
  outbox genérico — documentar essa exceção deliberada.
- Cadência de poller para o catálogo de Ferramentas: a cada 6h (muda com alguma frequência, mas
  não é webhook-capable).

## Critérios de aceite

### AC-1: Criar Ferramenta propaga ao Auvo
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cadastra uma Ferramenta (nome, categoria
  opcional, quantidade total)
- **Quando** salva
- **Então** `pcm.ferramentas` ganha a linha, o outbox enfileira, o drain cria em `/products/` com
  `externalId`, grava `auvo_id`

### AC-2: Editar propaga como PATCH
- Mesmo padrão de `E01-S26` AC-2.

### AC-3: Excluir é soft-delete → `PATCH active:false`
- Mesmo padrão geral do motor (Products tem `active`).

### AC-4: Mudança no Auvo chega ao PCM via poller a cada 6h
- Mesmo padrão de `E01-S24` AC-4, cadência diferente (6h em vez de diária).

### AC-5: Alocar Ferramenta a um Técnico (fluxo dedicado, fora do outbox genérico)
- **Dado** uma Ferramenta sincronizada (`auvo_id` preenchido) e um Técnico sincronizado
  (`auvo_user_id` de `pcm.funcionarios`/`tecnicos_cache`)
- **Quando** o usuário aloca uma quantidade na tela "Ferramentas por Técnico"
- **Então** `pcm.ferramenta_alocacoes` registra `(ferramenta_id, tecnico_id, quantidade)` e uma
  chamada dedicada (não outbox genérico) faz
  `PUT /products/employee-product-stock { userId, productId, amount }`

### AC-6: Tela "Ferramentas por Técnico" reflete o `employeesStock` do Auvo
- **Dado** o poller de `E01-S30` (ou um campo extra no `fromAuvo` de Ferramentas)
- **Quando** sincroniza uma Ferramenta
- **Então** `pcm.ferramenta_alocacoes` é atualizado a partir do array `employeesStock` retornado
  por `GET /products/{id}` — reconciliação por `(ferramenta_id, auvo_user_id)`

### AC-7: Telas com gate de permissão + RLS FORCE
- Mesmo padrão das demais entidades.

## Casos de borda e erros
- Alocar mais quantidade do que `totalStock` disponível: validar no domínio antes de chamar o
  Auvo (o Auvo provavelmente aceita qualquer número — a regra de não-exceder-estoque é do PCM).
- Ferramenta ou Técnico sem `auvo_id`/`auvo_user_id` ainda: bloquear a alocação na UI com
  mensagem clara ("sincronize a ferramenta/técnico primeiro").
- `amount: 0` na chamada de alocação — tratado como "remover a alocação" (mesma semântica do
  Auvo, a confirmar contra uma chamada real antes de produção).

## Fora de escopo
- Fluxo de aprovação/devolução de ferramenta (check-out/check-in físico) — só o registro de "quem
  está com o quê" no momento, sem histórico de movimentação nesta leva.
- `attachments`/`base64Image` do Product (foto da ferramenta) — fora de escopo, mesmo padrão de
  "sem Storage" já adotado em outras stories (`E01-S15`/`E01-S19`).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
- Depende de: `../E01-S26-catalogo-categorias/spec.md` (categoria de produto)
