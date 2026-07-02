---
name: product
description: PRD-lite da fundação de integração Auvo (cliente HTTP, sync de clientes, criação de task).
alwaysApply: false
---

# Product — Integração Auvo: Fundação

> **Tier:** arquitetural · **Status:** rascunho · **Dono:** Fabrício (Sinérgica) / Claude (estudo)
> Responde: **por quê** e **para quem**. Mantém em 1 página.

## Problema
O PCM já modela a decisão de manutenção (backlog, OS, prioridade), mas não existe hoje nenhum
código no repo que fale com o Auvo — só colunas de integração preparadas em
`pcm.clientes.auvo_id` e `pcm.ordens_servico.{auvo_task_id, auvo_sync_status, auvo_synced_at,
auvo_sync_error}` (migration `0001_E00-S00`) e um blueprint técnico
(`docs/blueprint/integracoes/auvo.md`) e um ADR (`0001-pcm-origin-truth-externalid.md`) já
aprovados. Sem essa integração, toda OS que devesse ir a campo precisa ser recriada manualmente
no app Auvo pelo escritório — duplicando trabalho e quebrando o "PCM como *system of record*"
que é premissa do produto (`docs/PROJECT.md`, `docs/ARCHITECTURE.md`).

## Para quem
- **Escritório** (papel `escritorio`): hoje faz double-entry manual da OS no Auvo. Ocorre a cada
  OS que muda para planejamento — várias por dia.
- **Técnico** (papel `tecnico`): depende do Auvo estar com a task certa para executar em campo;
  hoje o vínculo cliente PCM ↔ cliente Auvo é manual e sujeito a erro de digitação/duplicidade.

## Resultado esperado / métrica de sucesso
- Métrica: nº de OS que entram em `planejamento` no PCM e aparecem automaticamente como task no
  Auvo, sem intervenção manual.
- Baseline: hoje 0% (processo 100% manual, fora do sistema). Alvo: 100% das OS com categoria que
  já tem `taskTypeId` mapeado (`corretiva`, `preventiva`, `inspecao` — ver `design.md`).

## Goals
- Cliente HTTP Auvo reutilizável (auth, retry de 401, rate limit) — base para todas as Edge
  Functions de integração (fundação + `E01-S10` + `E01-S11`).
- Sincronizar `pcm.clientes` → clientes Auvo por `externalId`, sem duplicar (idempotente).
- Criar task no Auvo automaticamente quando uma OS entra no status `planejamento`, com
  `externalId = os.id` (regra já decidida em `docs/blueprint/01-pcm-operacao.md` e ADR-0001).

## Non-goals
- Consumir o resultado da execução (status, fotos, checklist) — isso é webhook, escopo de
  `E01-S10`.
- Espelhar técnicos/equipes ou equipamentos do Auvo no PCM — escopo de `E01-S11`.
- Orçamentos, despesas, notas fiscais, financeiro do Auvo — fora do PCM v2 (não mapeado como
  prioridade em `docs/blueprint/integracoes/auvo.md`, ~15% dos 141 endpoints é o ponto de
  partida).
- UI de conflito de sync (`auvo_sync_status = in_conflict`) — este story só grava o status; a
  tela de resolução fica para uma story de UI do Hub de OS (`E01-S07`).
- Despacho automático a partir do Zé (`E01-S02` exclui isso explicitamente do próprio escopo).

## Riscos / premissas
- Premissa: os IDs de `taskTypeId` já configurados no blueprint (corretiva=228714,
  preventiva=139989, inspecao=179776) continuam válidos na conta Auvo de produção — precisa
  confirmação com Fabrício antes do primeiro deploy real (`levantamento`/`emergencial` ainda sem
  ID, ver `design.md` → Questões em aberto).
- Premissa: rate limit de 400 req/min é suficiente para o volume atual de OS/clientes da
  Sinérgica (baixo volume, dezenas de condomínios) — sem necessidade de fila no MVP.
- Risco: se o Auvo estiver fora do ar no momento da transição para `planejamento`, a OS não pode
  ficar travada — precisa de retry assíncrono (ver `design.md` → Riscos).
