---
name: spec
description: Contrato — tipo_tarefa_id estruturado em pcm.ordens_servico + resolução real do taskType no Auvo.
alwaysApply: true
---

# Spec — `tipo_tarefa_id` estruturado + resolução real do taskType no Auvo

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (ver `design.md`)
> Feedback de teste manual do Lucas (2026-07-09, ponto 1, achado técnico): o tipo de tarefa escolhido no
> modal de Nova OS nunca chega no Auvo — vira texto solto em `descricao`.

## Resumo
`pcm.ordens_servico` ganha `tipo_tarefa_id uuid` (FK `pcm.tipos_tarefa`). A criação de OS grava esse
campo (junto de `tecnico_funcionario_id`/`data_agendada`, colunas já existentes desde E01-S38).
`pcm-auvo-create-task` resolve o `taskTypeId` real do Auvo a partir de `tipo_tarefa_id` quando presente,
com fallback pro mapa hardcoded por categoria (compatibilidade retroativa).

## Critérios de aceite

### AC-1: OS criada com tipo de tarefa gera task Auvo com o taskType certo
- **Dado** uma OS criada com `tipo_tarefa_id` apontando pra um tipo com `auvo_id` confirmado
- **Quando** `pcm-auvo-create-task` roda (transição pra `planejamento`)
- **Então** a chamada `POST /tasks` usa `taskTypeId = tipos_tarefa.auvo_id` desse tipo

### AC-2: Fallback por categoria continua funcionando
- **Dado** uma OS sem `tipo_tarefa_id` (ex.: nascida de import/webhook de tarefa já existente no Auvo)
- **Quando** `pcm-auvo-create-task` roda
- **Então** resolve `taskTypeId` via `AUVO_TASK_TYPE_MAP` por `categoria`, exatamente como hoje — sem
  regressão

### AC-3: Nenhum dos dois resolve → falha explícita
- **Dado** uma OS sem `tipo_tarefa_id` e com `categoria` fora do `AUVO_TASK_TYPE_MAP`
- **Quando** `pcm-auvo-create-task` roda
- **Então** grava `auvo_sync_status='failed'` com motivo claro, **sem** chamar `POST /tasks` (AC-7 de
  E01-S09, sem regressão)

### AC-4: Técnico e data prevista persistem estruturados na criação
- **Dado** o modal com técnico/data prevista preenchidos
- **Quando** a OS é criada
- **Então** `tecnico_funcionario_id`/`data_agendada` são gravados como colunas (não mais só texto em
  `descricao`)

### AC-5: Migração segura em produção
- **Dado** as ~2364 linhas existentes de `pcm.ordens_servico`
- **Quando** a migration roda (`NOT VALID` + `VALIDATE CONSTRAINT` em transação separada)
- **Então** nenhuma linha existente é afetada (`tipo_tarefa_id` novo é `null` em todas) e a validação da
  FK passa sem erro

## Casos de borda e erros
- `tipo_tarefa_id` aponta pra um tipo sem `auvo_id` confirmado (tipo só local, nunca sincronizado): trata
  como "não resolveu" e cai no fallback de categoria (não como erro fatal).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Mudar `AUVO_TASK_TYPE_MAP`/expandir os 3 valores confirmados — fica como está, é só fallback.
- Editar tipo de tarefa/técnico/data de uma OS já criada — fluxo de edição de OS não muda aqui.
- Qualquer coisa do read-path (webhook/import de tarefas Auvo) — já usa `tecnico_funcionario_id`/
  `data_agendada` desde E01-S38, não muda.

## Rastreabilidade
- Design: `./design.md`
- Depende de: E01-S39.
- Precedente de migration: E01-S38 (`0070`/`0071`).
- Arquivos-âncora: `supabase/migrations/0073_*.sql`, `supabase/migrations/0074_*.sql`,
  `apps/web/src/features/pcm/infrastructure/supabase-ordem-servico-adapter.ts`,
  `supabase/functions/pcm-auvo-create-task/index.ts`.
