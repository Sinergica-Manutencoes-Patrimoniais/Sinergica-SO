---
name: design-E01-S07-hub-de-os
description: "Design arquitetural do Hub de OS — fila unificada C1/C2/P1/P2/IN. Resolve a Decisão 5 adiada em E01-S03/design.md."
alwaysApply: false
---

# Design — E01-S07: Hub de OS (fila unificada)

> **Tier:** Arquitetural — decisão de schema (nova tabela vs. extensão de tabela existente).
> **Referência canônica de negócio:** `docs/blueprint/01-pcm-operacao.md` (seção "Hub de OS").
> **Resolve:** a Decisão 5 do `design.md` de E01-S03, que adiou esta escolha explicitamente.

## Decisão 1 — Estender `pcm.ordens_servico`, não criar `pcm.os_hub`

O blueprint propõe o nome de tabela `pcm.os_hub` mas deixa a escolha real em aberto: **(a)** nova
tabela que projeta/unifica OS + schedules PMOC, ou **(b)** refatorar `pcm.ordens_servico` pra absorver
os tipos C1/C2/P1/P2/IN.

**Decisão: (b) — estender `pcm.ordens_servico`.**

`pcm.ordens_servico` já é a fila operacional real e única do PCM: 2364+ linhas em produção, sync
bidirecional com Auvo (`auvo_task_id`, `check_in_at`/`check_out_at`, `tecnico_funcionario_id`,
`data_agendada` — E01-S38), tipo de tarefa real (`tipo_tarefa_id` — E01-S40), UI completa (Kanban,
Timeline, Calendário, filtros — E01-S42/E01-S43). Criar uma tabela paralela `os_hub` duplicaria esse
estado operacional inteiro (quem tá alocado, status, vínculo Auvo) ou viraria só uma *view* — nesse
caso não há razão pra ser uma tabela própria, é melhor ser um cálculo sobre `ordens_servico`.

Mesmo padrão já usado nesta sessão: ADR-0009 (E01-S76) decidiu estender `pcm.equipamentos` em vez de
criar `pcm.itens`, pelo mesmo motivo (preservar pipeline/estado existente, evitar fragmentar a fonte
da verdade). Ver ADR-0010.

## Decisão 2 — Prioridade é **calculada**, nunca armazenada

O blueprint define a prioridade por regra determinística (C1→1, C2→2, P1 atrasada→2, P1 no
prazo→3, P2→3, IN→4). Se isso fosse uma coluna gravada, precisaria de um cron pra "promover" P1 de 3
pra 2 no dia em que atrasa — mais uma Edge Function, mais um ponto de falha silenciosa (o padrão que
gerou o incidente de E00-S11 no histórico deste projeto).

**Decisão:** `prioridadeHub` é sempre **calculada em runtime** (domínio puro, `calcularPrioridadeHub`)
a partir de `tipo_os` + `data_agendada` + hoje — nunca uma coluna. Zero staleness possível.

## Decisão 3 — `tipo_os` é inferido de `categoria`, com override manual

`CategoriaOs` já existe (`corretiva | preventiva | melhoria | inspecao | emergencial | outro`,
`domain/abertura-os.ts`). Mapeamento pra `TipoOsHub` (`C1 | C2 | P1 | P2 | IN`):

| categoria | tipo_os | condição extra |
|---|---|---|
| `emergencial` | `C1` | — |
| `corretiva` | `C2` | — |
| `preventiva` | `P1` | se `pmoc_schedule_id` setado (origem PMOC) |
| `preventiva` | `P2` | se `pmoc_schedule_id` nulo (preventiva predial geral) |
| `inspecao` | `IN` | — |
| `melhoria`, `outro` | *(nenhum)* | fora do Hub — não é fila urgente, não recebe prioridade Hub |

Coluna `tipo_os` é gravada (não recalculada a cada leitura) porque, ao contrário da prioridade, o tipo
não muda com o tempo — só muda se o usuário editar a categoria da OS. Inferida na criação, mas
pode ser sobrescrita manualmente (ex.: uma "corretiva" que na prática é tratada como P2).

## Decisão 4 — `pmoc_schedule_id`: coluna preparada, sem produtor ainda

Adiciona `pmoc_schedule_id uuid references pcm.pmoc_schedules` nullable em `ordens_servico`. **Nenhum
código cria essa linha ainda** — o produtor real é a Edge Function `pmoc-auvo-create-os` (blueprint:
diário 08:00, cria OS pra `scheduled_date = hoje+7d`), que está no mesmo bloco deferido de S05/cron
(Deno, não verificável localmente, ver `tasks.md`). A coluna existe desde já pra não exigir outra
migration quando a função for construída — schema pronto, produtor pendente (mesmo padrão do resto
do backlog PMOC nesta sessão).

## Decisão 5 — "Dias preventivos" fica fora desta story

O blueprint descreve dias da semana por técnico reservados só pra P1/P2. Isso exige um conceito novo
(agenda semanal por funcionário) que não existe hoje — `tecnico_funcionario_id` em `ordens_servico`
vem do sync do Auvo (quem já está alocado na tarefa), não de um motor de alocação do PCM. Construir
esse motor é uma feature própria (config em `pcm.funcionarios` + algoritmo de alocação), não um
sub-item de "adicionar uma coluna". **Fora de escopo, deferido explicitamente** — não é regressão,
é um recorte consciente de escopo (ver `tasks.md`).

## Diagrama

```
pcm.ordens_servico (existente, estendida)
  + tipo_os text null              -- C1|C2|P1|P2|IN, inferido de categoria (+ pmoc_schedule_id)
  + pmoc_schedule_id uuid null     -- FK pmoc_schedules, coluna pronta, produtor pendente (S05/cron)

prioridadeHub(tipo_os, data_agendada, hoje) -- domínio puro, NUNCA gravado
  C1 → 1 | C2 → 2 | P1 atrasada → 2 | P1 no prazo → 3 | P2 → 3 | IN → 4 | sem tipo_os → não entra no Hub
```

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| Estender `ordens_servico` (escolhida) | Fonte única, reusa UI/sync Auvo existentes, zero duplicação | Tabela já grande cresce mais | **Escolhida** — mesmo racional do ADR-0009 |
| Nova tabela `pcm.os_hub` (projeção) | Isolamento conceitual "limpo" | Duplicaria estado operacional ou seria só view (sem motivo de ser tabela); mais um lugar pra sincronizar | Rejeitada |
| Prioridade como coluna gravada | Leitura mais barata | Precisa de cron pra não ficar stale (risco de silêncio, já visto em E00-S11) | Rejeitada |
