---
name: spec
description: Contrato — CRUD de Tipos de Tarefa no PCM, sincronizado com Auvo /tasktypes (cron, sem webhook).
alwaysApply: true
---

# Spec — Tipos de Tarefa (catálogo Auvo, primeira entidade do motor)

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno (spec.md + tasks.md — usa o motor já
> construído em `E01-S22`/`E01-S23`, não introduz mecanismo novo)
> Primeira entidade a usar o motor de ponta a ponta — valida o padrão antes de escalar para o
> resto do catálogo (`E01-S25`+). Endpoint Auvo: `/tasktypes` (sem webhook — só cron).

## Resumo
O Fabrício cadastra/edita/desativa Tipos de Tarefa (ex.: "Manutenção Preventiva de Ar
Condicionado") direto no PCM; a mudança se propaga ao Auvo pelo motor de `E01-S22`, e qualquer
alteração feita no Auvo aparece no PCM via o poller diário de `E01-S23` (Task Types não suporta
webhook — só as 6 entidades da API `/webhooks`, Task Type não está entre elas).

## Contexto específico desta entidade (ler antes de implementar)
- Endpoint `/tasktypes`: `GET`/`POST`/`PATCH`/`DELETE` por `id` (bigint), `GET` lista com
  `paramFilter`/paginação.
- **Sem `externalId`/campo de idempotência documentado no `POST`** (diferente de
  Customers/Tasks/Products/Equipments, que têm `externalId`). Isso enfraquece a garantia de
  "reenviar não duplica" do `AC-4` genérico do motor — ver Casos de borda abaixo.
- Corpo do `POST`: `description` (obrigatório, até 5000 chars), `standartQuestionnaireId`,
  `standartTime` (formato `HH:mm:ss`), `sendSatisfactionSurvey`, `sendDigitalOs`, `active`,
  `requirements` (objeto aninhado: `fillReport`, `getSignature`, `fillRolledKilometer`,
  `emailTheTask`, `minimumNumberOfPhotos`, `requiredQuestionnaires[]`).
- `PATCH` é JSON Patch (`_shared/auvo/json-patch.ts`, já implementado em `E01-S22`).
- Sem webhook — só polling. Cadência proposta: diária (catálogo estático, ver design.md → Adendo
  read path).

## Critérios de aceite

### AC-1: Criar Tipo de Tarefa no PCM propaga ao Auvo
- **Dado** um usuário com `podeAcessar('pcm','escrita')` preenche o formulário "Novo Tipo de
  Tarefa" (nome obrigatório; requisitos de preenchimento de relato/assinatura/fotos mínimas
  opcionais)
- **Quando** salva
- **Então** a linha é criada em `pcm.tipos_tarefa` (`auvo_sync_status='pending'`), o outbox
  enfileira, e o drain (`E01-S22`) cria o Tipo de Tarefa no Auvo, gravando `auvo_id` de volta

### AC-2: Editar propaga como PATCH (JSON Patch)
- **Dado** um Tipo de Tarefa já sincronizado (`auvo_id` preenchido)
- **Quando** o usuário edita nome/requisitos e salva
- **Então** o drain envia `PATCH /tasktypes/{auvo_id}` no formato JSON Patch, nunca um novo `POST`

### AC-3: Excluir é soft-delete → `active:false` no Auvo
- **Dado** um Tipo de Tarefa em uso (ou não) por OS existentes
- **Quando** o usuário exclui pela tela do PCM
- **Então** `pcm.tipos_tarefa.deleted_at` é preenchido, o Auvo recebe `PATCH active:false`, e a
  tela deixa de listar o registro (mas OS antigas que o referenciam continuam íntegras — sem FK
  `ON DELETE CASCADE`, é soft-delete)

### AC-4: Mudança no Auvo chega ao PCM via poller diário
- **Dado** um Tipo de Tarefa criado ou editado diretamente no Auvo (ex.: por outro sistema)
- **Quando** o poller diário (`pcm-auvo-pull`, `E01-S23`) roda
- **Então** `pcm.tipos_tarefa` é atualizado (upsert por `auvo_id`) sem re-disparar o outbox
  (anti-loop via `fn_apply_auvo_sync`)

### AC-5: Tela lista/cria/edita/exclui com gate de permissão
- **Dado** um usuário sem `podeAcessar('pcm','escrita')`
- **Quando** acessa a tela "Tipos de Tarefa" (CADASTROS)
- **Então** vê a listagem (leitura) mas não vê os controles de criar/editar/excluir

### AC-6: RLS FORCE + módulo `pcm`
- **Dado** `pcm.tipos_tarefa`
- **Quando** qualquer acesso via PostgREST
- **Então** `authenticated` só lê/escreve com `user_modulos.pcm` em `leitura`/`escrita`
  (leitura)/`escrita` (escrita), mesmo padrão de `db/rls.template.sql`; `service_role` (motor de
  sync) sempre passa

## Casos de borda e erros
- **Sem `externalId` no `POST /tasktypes/`**: se o drain criar no Auvo com sucesso mas a escrita
  de `auvo_id` de volta no PCM falhar (ex.: rede cai entre as duas chamadas), um retry
  subsequente do outbox criaria um SEGUNDO Tipo de Tarefa duplicado no Auvo (não há chave para o
  Auvo recusar/deduplicar). **Mitigação adotada**: antes do `POST`, o `toAuvo`/fluxo de criação
  faz um `GET /tasktypes?paramFilter={description}` best-effort e usa o primeiro resultado com
  `description` EXATAMENTE igual como `auvo_id`, só criando se não achar — reduz mas não elimina
  o risco (nome poderia colidir por coincidência; aceitável para um catálogo pequeno e curado
  pelo Fabrício). Documentar esse comportamento explicitamente no código (mesmo cuidado do "não
  pegar `search.result[0]` às cegas" já aplicado em `pcm-auvo-customers-sync`/`pcm-auvo-create-task`
  — aqui o match tem que ser exato por `description`, não "primeiro resultado").
- Nome duplicado dentro do PCM (dois Tipos de Tarefa com o mesmo `nome`): permitido — não há
  unicidade de negócio conhecida que justifique bloquear (o Auvo também não modela isso como erro).
- `requirements.minimumNumberOfPhotos` negativo ou não-inteiro: validado no domínio antes de
  qualquer chamada (rejeitado na UI, nunca chega ao outbox).

## Fora de escopo
- Vincular Tipos de Tarefa a Categorias/Segmentos (não existe essa relação na API Auvo para este
  recurso).
- Editar `standartQuestionnaireId`/`requiredQuestionnaires` apontando para questionários reais —
  o Auvo expõe `GET /questionnaires` só leitura; se o Fabrício precisar escolher um questionário
  padrão, a tela mostra a lista (leitura via `pcm-auvo-pull` de um descriptor read-only, se
  necessário) mas não cria/edita questionário — fora do catálogo desta épica.

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`,
  `docs/adr/0005-outbox-sync-auvo.md`
