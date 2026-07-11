---
name: spec
description: Contrato — plano preventivo/PMOC do PCM materializado no Auvo via recorrência nativa (/serviceorders ou tarefas recorrentes). Tier arquitetural, exige design.md antes de codar.
alwaysApply: true
---

# Spec — Preventivo recorrente: PCM comanda, Auvo executa

> **Fonte da verdade.** Status: rascunho · Tier: **Arquitetural** (nova entidade central + write na
> conta de produção + decisão de mecanismo irreversível) — **`design.md` do @architect obrigatório
> antes de implementar.**
> Origem: `docs/AUDITORIA-AUVO-API.md`. Achados: (a) a API `/serviceorders` tem **recorrência
> nativa** (`recurrenceType` daily/weekly/monthly/yearly, `recurrenceDays`, `monthlyMode`,
> questionário default, responsável default, prioridade, anexos); (b) o módulo "Ordens de
> Serviço/Projetos" está **vazio na conta** — o PCM pode nascer dono do preventivo sem migração;
> (c) o preventivo é a maior lacuna do PCM hoje (ESCOPO-MESTRE §6.1 "Plano Preventivo & PMOC",
> dor L4, conformidade §9).

## Resumo
O PCM ganha **Plano Preventivo por cliente/equipamento** (periodicidade, tipo de tarefa,
questionário, responsável). Ao ativar um plano, o PCM cria a recorrência no Auvo; as tarefas que o
Auvo gera voltam pelo caminho já existente (webhook + `tasks-import`) e viram OS
`categoria='preventiva'` ligadas ao plano. Calendário de OS (E01-S38) passa a mostrar
previsto×executado do preventivo; atrasos ficam visíveis (OS preventiva com data passada ≠
finalizada = pendência).

## Decisão de design (para o design.md resolver ANTES)
- **Mecanismo A:** `POST /serviceorders` (recorrência nativa, entidade-mãe no Auvo). Prós: agrupa
  visitas, questionário/responsável default. Contras: módulo nunca usado pela operação; webhook de
  Service Order não existe (só polling); contrato real não verificado.
- **Mecanismo B:** `POST /tasks` com repetição (a UI de Nova Tarefa tem aba "Repetição") ou o PCM
  gera as tarefas uma a uma via cron próprio. Prós: caminho de task já 100% verificado em produção.
  Contras: recorrência fica no PCM (mais código nosso) ou contrato de repetição de task a verificar.
- O design decide A ou B **após teste de contrato com credencial real** (criar 1 registro de teste,
  inspecionar, excluir). Sem credencial de API, a story fica bloqueada — não inventar payload.

## Critérios de aceite

### AC-1: CRUD de plano preventivo local
- **Dado** um cliente com equipamentos
- **Quando** o usuário cria um plano (escopo: cliente ou equipamento; periodicidade; tipo de tarefa
  real; questionário opcional; responsável; hora/duração)
- **Então** o plano fica em `pcm.planos_preventivos` com status `rascunho|ativo|pausado`

### AC-2: Ativação materializa no Auvo
- **Dado** um plano `rascunho`
- **Quando** ativado
- **Então** o PCM cria a recorrência no Auvo (mecanismo do design) com idempotência (`externalId`/
  código de referência) e guarda o vínculo (`auvo_service_order_id` ou equivalente)

### AC-3: Ocorrências voltam como OS preventivas
- **Dado** o Auvo gerando as tarefas da recorrência
- **Quando** webhook/`tasks-import` as processa
- **Então** viram OS `categoria='preventiva'` vinculadas ao plano (`plano_preventivo_id`), sem duplicar

### AC-4: Aderência visível
- **Dado** OS preventivas do plano
- **Quando** o usuário abre o cliente-360 ou o calendário
- **Então** vê % de preventivo cumprido no período e as atrasadas destacadas (data passada + status
  ≠ finalizado)

### AC-5: Pausar/encerrar propaga
- **Dado** um plano ativo
- **Quando** pausado/encerrado no PCM
- **Então** a recorrência correspondente para no Auvo (PATCH/DELETE conforme mecanismo), sem apagar
  OS históricas

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Laudo PMOC/documento legal (é o sub-módulo PMOC, E01-S03..S08).
- Roteirização das visitas geradas (§6.11).
- Alertas de vencimento de conformidade (painel §9 — story futura).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · ESCOPO-MESTRE §6.1 (Plano Preventivo & PMOC), §9, dor L4.
- Contrato API: `POST/GET/PATCH /serviceorders` (spec OpenAPI oficial) — requer verificação real.
- Arquivos-âncora: novo slice `features/pcm` (planos), `supabase/functions/_shared/auvo/`,
  `pcm-auvo-webhook`/`pcm-auvo-tasks-import` (vínculo plano→OS), ADR novo (PCM dono do preventivo).
