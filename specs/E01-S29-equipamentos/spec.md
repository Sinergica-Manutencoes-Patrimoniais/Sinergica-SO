---
name: spec
description: Contrato — CRUD de Equipamentos no PCM, sincronizado com Auvo /equipments (webhook Equipment), preservando o Auvo como autoridade operacional.
alwaysApply: true
---

# Spec — Equipamentos

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno (usa o motor já construído; a decisão de
> origem/autoridade foi formalizada em `docs/adr/0006-pcm-origem-cadastro-equipamentos-auvo-operacional.md`)
> Endpoint: `/equipments`. Webhook `Equipment` (entity=27).

## Resumo
Equipamentos passam a ter cadastro operacional no PCM, com criação/edição/desativação feitas pelo
Fabrício sem abrir o Auvo. O PCM **origina os comandos e registra a intenção de negócio**; o Auvo
continua sendo a autoridade operacional do equipamento no campo e devolve seu `id`/estado por sync
e webhook.

Essa decisão não transforma o PCM em uma segunda fonte concorrente. O padrão é o mesmo de OS em
`ADR-0001`: o usuário trabalha no PCM, o PCM movimenta o Auvo, e o Auvo segue como sistema externo
de execução/realidade operacional.

## Contexto específico (ler antes de implementar)
- `pcm.equipamentos_cache` existe desde `E01-S11` como cache mínimo read-only alimentado pelo
  Auvo. Esta story promove esse cache para uma tabela editável (`pcm.equipamentos` ou evolução
  compatível), com colunas de cadastro que hoje estavam deliberadamente fora do PCM em `E01-S16`.
- A decisão de `E01-S16` ("Auvo é dono do equipamento, PCM não duplica") continua válida quanto à
  autoridade operacional: o Auvo mantém o identificador externo, o uso em campo e o retorno por
  webhook. O que muda é a origem dos comandos: o registro/cadastro agora começa no PCM e movimenta
  o Auvo.
- `POST /equipments/` tem `externalId`, então criação pelo PCM deve ser idempotente
  (`externalId = equipamento.id`), mesmo em retry do outbox.
- `PATCH /equipments/{id}` é JSON Patch. `DELETE` físico existe, mas **não é usado** — se o recurso
  tiver `active`, aplicar soft-delete por `PATCH active:false` no mesmo padrão da épica; se o campo
  real divergir, registrar achado antes de implementar.
- Webhook `Equipment` (entity=27) é uma das entidades em tempo real já cobertas pelo dispatcher de
  `E01-S23`.
- `pcm.os_equipamentos_auvo` (`E01-S16`) continua existindo. Ele representa vínculo OS ↔
  equipamento, não o cadastro do equipamento em si.

## Critérios de aceite

### AC-1: Criar Equipamento no PCM propaga ao Auvo com `externalId`
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cadastra um equipamento
- **Quando** salva
- **Então** `pcm.equipamentos` ganha a linha, o outbox enfileira, o drain chama
  `POST /equipments/` com `externalId = equipamento.id`, grava `auvo_id`

### AC-2: Editar Equipamento propaga como PATCH
- **Dado** um equipamento sincronizado (`auvo_id` preenchido)
- **Quando** o usuário edita identificador, categoria, cliente/vínculo ou dados cadastrais
- **Então** o drain envia `PATCH` (JSON Patch) para `/equipments/{auvo_id}`

### AC-3: Excluir/desativar é soft-delete, nunca DELETE físico
- **Dado** um equipamento sincronizado
- **Quando** o usuário exclui/desativa no PCM
- **Então** `deleted_at` é preenchido no PCM e o Auvo recebe um PATCH de desativação, preservando
  histórico operacional e vínculos de OS

### AC-4: Mudança no Auvo chega ao PCM em tempo real
- **Dado** um equipamento alterado diretamente no Auvo
- **Quando** o webhook `Equipment` chega
- **Então** `pcm.equipamentos` é atualizado via `fn_apply_auvo_sync`, sem reenfileirar outbox

### AC-5: Vínculo OS ↔ equipamento continua separado
- **Dado** uma OS associada a um equipamento
- **Quando** o cadastro do equipamento muda
- **Então** `pcm.os_equipamentos_auvo` continua apontando para o mesmo `auvo_equipment_id` e não
  recebe colunas duplicadas de ficha técnica; o cadastro fica em `pcm.equipamentos`

### AC-6: Tela lista/cria/edita com gate de permissão
- Mesmo padrão das demais entidades — leitura para todos com `pcm:leitura`, edição só com
  `pcm:escrita`.

### AC-7: RLS de `pcm.equipamentos` é RELAXADA de `pcm.equipamentos_cache`, deliberadamente
- **Dado** a migration de promoção
- **Quando** aplicada
- **Então** as policies `*_deny_insert`/`*_deny_update`/`*_deny_delete` de `0012` são substituídas
  por policies de escrita por módulo (`db/rls.template.sql`), com comentário na migration
  apontando para `ADR-0006`

## Casos de borda e erros
- Equipamento criado no PCM e ainda sem `auvo_id`: aparece como "aguardando sync" e bloqueia
  vínculos/ações que exijam o id real do Auvo até o outbox concluir.
- Equipamento com OS aberta não deve ser desativado sem confirmação explícita na UI, porque o
  vínculo histórico precisa continuar legível.
- Se o webhook do Auvo trouxer dados que divergem do PCM enquanto há outbox pendente, o motor deve
  seguir a regra geral de `E01-S22`/`E01-S23`: aplicar entrada externa por `fn_apply_auvo_sync`,
  registrar erro se houver conflito não resolvível, e não entrar em loop.

## Fora de escopo
- Prontuário técnico completo de ativo/PMOC.
- Histórico detalhado de movimentação do equipamento entre clientes/OS além do vínculo já existente
  em `pcm.os_equipamentos_auvo`.
- Anexos/fotos do equipamento em Storage.

## Rastreabilidade
- Decisão durável: `docs/adr/0006-pcm-origem-cadastro-equipamentos-auvo-operacional.md`
- Decisão anterior reinterpretada: `../E01-S16-relacionamento-equipamento-auvo-pcm/spec.md`
- Tabela a promover: `supabase/migrations/0012_E01-S11_cache_tecnicos_equipamentos.sql`
- Design/Domínio do motor: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
