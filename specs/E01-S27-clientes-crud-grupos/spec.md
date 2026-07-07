---
name: spec
description: Contrato — CRUD completo de Clientes no PCM (hoje só leitura na Visão 360) + Grupos de Clientes, sincronizados com Auvo /customers (webhook Customer) e /customergroups (cron, sem edição).
alwaysApply: true
---

# Spec — Clientes CRUD + Grupos de Clientes

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno (usa o motor já construído; `pcm.clientes`
> já existe desde `0001`/`0022` — não é tabela nova, é a primeira entidade EXISTENTE a ganhar
> write-path completo pelo motor)
> Endpoints: `/customers` (webhook Customer=7 + `/customers/complete` opcional), `/customergroups`
> (só cron — sem PATCH documentado, ver Casos de borda).

## Resumo
Hoje `pcm.clientes` é alimentado só por `pcm-auvo-customers-sync` (create/link automático quando
uma OS entra em planejamento) e `pcm-auvo-customers-import` (bootstrap Auvo→PCM). Não existe
tela de criar/editar/excluir cliente no PCM — o Fabrício que precisa cadastrar um cliente novo
sem já ter uma OS ainda usa o Auvo direto. Esta story fecha esse buraco: CRUD completo de Cliente
na `ListaClientesPage`/`VisaoClientePage` já existentes, propagando pelo motor de `E01-S22`, e
Grupos de Clientes como catálogo auxiliar (cron, sem edição possível no Auvo).

## Contexto específico (ler antes de implementar)
- `pcm.clientes` **já existe** (migration `0001`, enriquecida em `0022`) com `auvo_id`,
  cadastro rico (endereço, contatos). Esta story **adiciona** o trigger `fn_auvo_enqueue('clientes')`
  e as colunas de sync que ainda faltarem (`auvo_sync_status`/`auvo_sync_error`/`auvo_synced_at` —
  conferir se já existem antes de recriar).
- `POST /customers/`: `externalId`, `name`, `phoneNumber[]`, `email[]`, `manager`, `note`,
  `address`, `latitude`/`longitude`, `cpfCnpj`, `groupsId[]`, `segmentId`, `active`, `legalName`,
  `contacts[]`. Existe `POST /customers/complete` com campos de faturamento/observações — **fora
  de escopo** desta story (o cadastro rico do PCM já cobre o essencial via `0022`; `complete` fica
  para se algum dia o Fabrício precisar dos campos fiscais).
- `PATCH /customers/{id}` é JSON Patch. `DELETE` físico existe, mas **não é usado** — `active`
  existe (soft-delete padrão do motor: `deleted_at` no PCM → `PATCH active:false` no Auvo).
- **Webhook**: `Customer` é uma das 6 entidades com `POST /webhooks` (entity=7) — `E01-S23` já
  cobre o dispatcher genérico; esta story só precisa registrar o descriptor com
  `webhookEntity: 7`.
- **Grupos de Clientes** (`/customergroups`): só `POST` (criar, `description` + `clientsId[]`),
  `DELETE`, `GET` lista, `GET /customergroups/{id}/clients`. **Sem `PATCH`/edição documentada** —
  ver Casos de borda.

## Critérios de aceite

### AC-1: Criar Cliente no PCM propaga ao Auvo
- **Dado** um usuário com `podeAcessar('pcm','escrita')` preenche o formulário de novo cliente
  (nome obrigatório; CNPJ, endereço, contatos opcionais)
- **Quando** salva
- **Então** `pcm.clientes` ganha a linha (reaproveitando o schema já existente), o outbox
  enfileira, o drain cria em `/customers/` com `externalId = cliente.id`, grava `auvo_id`

### AC-2: Editar Cliente propaga como PATCH
- **Dado** um cliente já sincronizado (`auvo_id` preenchido — a maioria já está, via import)
- **Quando** o usuário edita nome/endereço/contato na `VisaoClientePage`/tela de edição
- **Então** o drain envia `PATCH` (JSON Patch)

### AC-3: Excluir é soft-delete → `PATCH active:false`
- **Dado** um cliente sem OS pendente (ver Casos de borda para cliente COM OS pendente)
- **Quando** o usuário exclui
- **Então** `deleted_at` preenchido no PCM, `PATCH active:false` no Auvo

### AC-4: Mudança no Auvo chega ao PCM em tempo real (webhook)
- **Dado** um cliente editado diretamente no Auvo (ex.: técnico corrige telefone pelo app)
- **Quando** o webhook `Customer` (action=Alteração) chega
- **Então** `pcm.clientes` é atualizado (upsert por `auvo_id`) via `fn_apply_auvo_sync`, sem
  reenfileirar (anti-loop)

### AC-5: Exclusão no Auvo vira soft-delete no PCM
- **Dado** o webhook `Customer` com `action=Exclusão`
- **Quando** processado
- **Então** `pcm.clientes.deleted_at` é preenchido (nunca `DELETE` físico no PCM — clientes têm
  histórico de OS que não pode ficar orfão)

### AC-6: Criar Grupo de Clientes propaga ao Auvo
- **Dado** um usuário cria um Grupo de Clientes com nome e uma lista de clientes já sincronizados
- **Quando** salva
- **Então** `pcm.cliente_grupos` ganha a linha, o outbox enfileira, o drain chama
  `POST /customergroups/` com `clientsId` resolvido a partir dos `auvo_id` dos clientes
  selecionados

### AC-7: Excluir Grupo de Clientes faz `DELETE` físico (sem PATCH disponível)
- **Dado** um Grupo de Clientes sincronizado
- **Quando** excluído no PCM
- **Então** `DELETE /customergroups/{auvo_id}` no Auvo (`deleteStrategy:'hard-delete'`, mesma
  extensão do registry de `E01-S25`)

### AC-8: Editar nome de Grupo de Clientes é só local (sem propagação)
- **Dado** a API Auvo não documenta `PATCH /customergroups/{id}`
- **Quando** o usuário renomeia um Grupo no PCM
- **Então** a mudança fica só no PCM; o outbox NÃO enfileira create/update para Grupos de
  Clientes além da criação inicial — a tela mostra um aviso "renomear aqui não reflete no Auvo"
  (ver Casos de borda)

### AC-9: Telas com gate de permissão + RLS FORCE
- Mesmo padrão das demais entidades — `podeAcessar('pcm','escrita')` para os controles,
  `podeAcessar('pcm','leitura')` para a listagem.

## Casos de borda e erros
- **Excluir cliente com OS aberta**: a UI bloqueia (mensagem explícita) — `pcm.ordens_servico.client_id`
  é FK não anulável (`0001`), soft-delete do cliente não quebra a FK tecnicamente, mas gera
  confusão operacional (OS de cliente "excluído" some da lista de clientes ativos enquanto a OS
  continua ativa). Regra de produto: só permitir excluir cliente sem OS em aberto
  (`status not in ('finalizado','cancelado')`).
- **Grupos de Clientes sem `PATCH`**: como o Auvo não tem endpoint de edição, o `fn_auvo_enqueue`
  trigger em `pcm.cliente_grupos` só deveria enfileirar em `INSERT`/soft-`DELETE`, nunca em
  `UPDATE` puro (editar nome não gera evento de sync) — implementar isso como uma variação do
  trigger genérico (parâmetro adicional? ou o descriptor simplesmente ignora `op='update'` no
  `pcm-auvo-push`, tratando como sucesso no-op) — decidir em `tasks.md`, documentar a escolha.
- Cliente sem `auvo_id` ainda (novo, nunca sincronizado) recebendo um webhook: não deveria
  acontecer (webhook só dispara para entidades que existem no Auvo), mas se ocorrer,
  `fn_apply_auvo_sync` faz `UPDATE ... WHERE id=$1` que não acha ninguém — no-op silencioso (AC-4
  do motor genérico já cobre esse caso).

## Fora de escopo
- `POST /customers/complete` (campos de faturamento/observações fiscais).
- Reclassificação em massa de clientes entre grupos.
- Edição de Grupo de Clientes propagada ao Auvo (API não suporta — ver AC-8).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`,
  `../E01-S23-motor-sync-auvo-read/spec.md` (webhook Customer)
- Código existente a estender: `apps/web/src/features/pcm/application/cliente-360-gateway.ts`,
  `infrastructure/supabase-cliente-360-adapter.ts`, `pages/ListaClientesPage.tsx`
