---
name: spec
description: Contrato — CRUD de Categorias de Produto e de Equipamento no PCM, sincronizado com Auvo /productcategories e /equipmentcategories (cron, sem webhook).
alwaysApply: true
---

# Spec — Categorias (Produto + Equipamento)

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno
> Bundla 2 entidades quase idênticas. Endpoints: `/productcategories`, `/equipmentcategories`.
> **Diferente de `E01-S24`/`E01-S25`: estas 2 entidades TÊM `externalId`** — idempotência
> `create` funciona pelo caminho padrão do motor (`AC-4` genérico de `E01-S22`), sem mitigação
> extra.

## Resumo
Categorias de Produto (usadas por `E01-S30` — Ferramentas/Kits) e de Equipamento (usadas por
`E01-S29`, hoje bloqueada) ganham CRUD no PCM.

## Contexto específico (ler antes de implementar)
- Ambos: `GET`/`POST`/`PATCH`/`DELETE` por `id`, `externalId` (string, até 255 chars) presente no
  `POST`. **Product Categories também tem `PUT` upsert** (usa `id` ou `externalId`); Equipment
  Categories não documenta `PUT` — só `POST`+`PATCH` (o motor de sync não usa `PUT` de qualquer
  forma, sempre `POST` na 1ª criação e `PATCH` depois, então essa diferença não afeta a
  implementação).
- Corpo: só `description` (obrigatório) + `externalId`. **Sem campo `active`** — mesma decisão de
  `deleteStrategy:'hard-delete'` de `E01-S25` (categoria excluída no PCM → `DELETE` físico no
  Auvo; risco baixo, é metadado de classificação).
- `PATCH` é JSON Patch.
- Sem webhook — poller diário.

## Critérios de aceite
> Aplicam-se às 2 entidades (Categoria de Produto e de Equipamento).

### AC-1: Criar propaga ao Auvo com idempotência real (`externalId`)
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cria uma Categoria com `nome` preenchido
- **Quando** salva
- **Então** a linha é criada em `pcm.produto_categorias`/`pcm.equipamento_categorias`, o outbox
  enfileira, e o drain cria no Auvo com `externalId = row.id` — reenviar a mesma linha (retry)
  NUNCA cria duplicata (diferente do caso de `E01-S24`/`E01-S25`)

### AC-2: Editar propaga como PATCH
- Mesmo padrão de `E01-S24` AC-2.

### AC-3: Excluir faz `DELETE` físico no Auvo (`deleteStrategy:'hard-delete'`)
- **Dado** uma Categoria sincronizada
- **Quando** o usuário exclui pelo PCM
- **Então** `deleted_at` preenchido no PCM, `DELETE /productcategories/{auvo_id}` ou
  `/equipmentcategories/{auvo_id}` no Auvo

### AC-4: Mudança no Auvo chega ao PCM via poller diário
- Mesmo padrão de `E01-S24` AC-4.

### AC-5: Telas com gate de permissão
- Mesmo padrão de `E01-S24` AC-5, 2 telas (`Categorias de Produto`, `Categorias de Equipamento`)
  — ou 1 tela com abas, decisão de implementação (`tasks.md`).

### AC-6: RLS FORCE + módulo `pcm`
- Mesmo padrão de `E01-S24` AC-6, 2 tabelas.

## Casos de borda e erros
- Excluir uma Categoria referenciada por Produtos/Equipamentos existentes: soft-delete no PCM não
  quebra a FK (categoria referenciada por `categoria_id` continua existindo até o `DELETE` físico
  no Auvo confirmar — decisão de produto: permitir exclusão mesmo com uso, a tela mostra um aviso
  "N produtos usam esta categoria" mas não bloqueia, já que o Auvo também não impede).
- Categoria com o mesmo nome em Produto e Equipamento (são catálogos independentes no Auvo, sem
  colisão possível entre eles).

## Fora de escopo
- Reclassificar produtos/equipamentos em massa ao excluir uma categoria (fica `categoria_id`
  apontando para uma categoria com `deleted_at` preenchido — aceitável, resolvido manualmente).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
- Stories relacionadas: `../E01-S24-catalogo-tipos-tarefa/spec.md` (mesmo padrão),
  `../E01-S30-ferramentas-kits/spec.md` (usa `produto_categorias`),
  `../E01-S29-equipamentos/spec.md` (usa `equipamento_categorias`, bloqueada)
