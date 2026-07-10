---
name: design
description: Design — tipo_tarefa_id estruturado em pcm.ordens_servico + resolução real do taskType no Auvo.
alwaysApply: true
---

# Design — `tipo_tarefa_id` estruturado + resolução real do taskType no Auvo

> Tier: arquitetural (schema change em `pcm.ordens_servico`, ~2364 linhas de produção). Aprovado por
> Lucas via ExitPlanMode em `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md` (2026-07-09) — a
> abordagem abaixo é exatamente a descrita e aprovada nesse plano.

## Problema
`NovaOrdemServicoModal.tsx` deixa o usuário escolher um "Tipo de tarefa Auvo" (E01-S39 já corrigiu a
lista pra vir de `pcm.tipos_tarefa`), mas essa escolha nunca chega no Auvo: `montarDescricao` só embute
o valor como texto solto em `descricao`. A criação real da task (`pcm-auvo-create-task/index.ts:70`)
resolve `taskTypeId` **exclusivamente** por `categoria` via `AUVO_TASK_TYPE_MAP` — um mapa hardcoded com
só 3 valores confirmados (corretiva/preventiva/inspeção). Mesmo problema para técnico/data prevista:
`tecnico_funcionario_id`/`data_agendada` já existem em `pcm.ordens_servico` desde a E01-S38 (migration
`0070`) mas nunca são gravados na criação — só ficam populados quando a OS nasce de uma tarefa já
existente no Auvo (import/webhook), nunca quando nasce no PCM.

## Decisão
Adicionar `tipo_tarefa_id uuid` como coluna própria (mesmo padrão `NOT VALID`+`VALIDATE CONSTRAINT` da
E01-S38, precedente `0070`/`0071`), gravá-la (junto com `tecnico_funcionario_id`/`data_agendada`, que já
existem) na criação da OS, e mudar `pcm-auvo-create-task` pra resolver o `taskTypeId` real em cascata:

1. Se `os.tipo_tarefa_id` estiver setado → buscar `pcm.tipos_tarefa.auvo_id` desse id.
2. Senão → fallback pro `AUVO_TASK_TYPE_MAP` por `categoria` (mantém compatibilidade retroativa — OS
   antigas, ou qualquer fluxo de criação que não passe pelo modal, continuam funcionando exatamente como
   hoje).
3. Nenhum dos dois resolver → falha explícita (AC-7 já existente em `E01-S09`, sem chamada `POST /tasks`
   com `taskTypeId` inválido).

Isso evita quebrar o comportamento hoje testado em produção (`AUVO_TASK_TYPE_MAP` continua a rede de
segurança) enquanto abre o caminho pro dado estruturado ser a fonte primária.

## Migration
`0073_E01-S40_tipo_tarefa_id_ordens_servico.sql` (nullable, `NOT VALID`):
```sql
alter table pcm.ordens_servico add column if not exists tipo_tarefa_id uuid;
alter table pcm.ordens_servico add constraint ordens_servico_tipo_tarefa_id_fkey
  foreign key (tipo_tarefa_id) references pcm.tipos_tarefa(id) not valid;
create index if not exists idx_os_tipo_tarefa on pcm.ordens_servico (tipo_tarefa_id);
```
`0074_E01-S40_validar_fk_tipo_tarefa_ordens_servico.sql`: `validate constraint` em transação separada
(mesmo padrão 0070/0071 — Squawk trava as duas tabelas pra validar).

Sem risco de violar dado existente: coluna nova é `null` em todas as 2364 linhas atuais, `VALIDATE
CONSTRAINT` passa trivialmente (toda FK null é válida).

## Alternativas consideradas
- **Só usar `AUVO_TASK_TYPE_MAP` expandido com mais categorias:** rejeitado — o mapa é `categoria→id`,
  1:1 fixo; a lista real de `pcm.tipos_tarefa` tem granularidade maior que as 6 categorias PCM (ex.:
  "Ar-Condicionado", "Bomba", etc.), perderia informação escolhida pelo usuário.
- **Não guardar `tecnico_funcionario_id`/`data_agendada` na criação, só no import:** rejeitado — o
  usuário já escolhe técnico/data no modal hoje (campos existem), só não persistem estruturadamente; não
  aproveitar colunas que já existem seria desperdiçar trabalho da E01-S38.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Precedente de migration: `0070`/`0071` (E01-S38).
- Depende de: E01-S39 (select já lendo `pcm.tipos_tarefa`).
