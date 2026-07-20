---
name: adr-0010-hub-de-os-estende-ordens-servico
description: Decisão para o Hub de OS — estende pcm.ordens_servico (tipo_os + prioridade calculada), não cria tabela pcm.os_hub separada.
alwaysApply: false
---

# ADR-0010 — Hub de OS estende `pcm.ordens_servico`; prioridade é sempre calculada, nunca gravada

**Status:** Aceito
**Data:** 2026-07-20
**Decisores:** Lucas (PO), @architect
**Relacionados:** ADR-0009, E01-S03/design.md (Decisão 5, adiada), E01-S07

## Contexto
O blueprint do Hub de OS (`docs/blueprint/01-pcm-operacao.md`) propõe uma fila unificada C1/C2/P1/
P2/IN com SLA e prioridade por tipo, citando uma tabela `pcm.os_hub`, mas deixa explicitamente em
aberto se isso é uma tabela nova (projeção de OS + schedules PMOC) ou uma extensão de
`pcm.ordens_servico`. O `design.md` de E01-S03 (Decisão 5) adiou essa escolha pro `design.md` de
E01-S07. `pcm.ordens_servico` já é a fila operacional real (2364+ linhas em produção, sync Auvo,
Kanban/Timeline/Calendário) quando esta decisão foi tomada.

## Decisão
1. **Estender `pcm.ordens_servico`** com `tipo_os text` (C1/C2/P1/P2/IN, inferido de `categoria` +
   presença de `pmoc_schedule_id`, sobrescrevível) e `pmoc_schedule_id uuid` (FK nullable pra
   `pcm.pmoc_schedules`, coluna pronta para quando a Edge Function de criação automática existir).
   **Não criar `pcm.os_hub`** como tabela separada.
2. **Prioridade do Hub é sempre calculada em runtime** (`calcularPrioridadeHub`, domínio puro) a
   partir de `tipo_os` + `data_agendada` + data atual — **nunca uma coluna gravada**. Evita cron de
   "promoção" de prioridade (P1 atrasada) e o risco de staleness silenciosa.
3. **"Dias preventivos"** (alocação de técnico por dia da semana) fica **fora desta story** — exige
   um motor de alocação que não existe hoje; feature própria futura.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| Estender `ordens_servico` (escolhida) | Fonte única de OS; reusa sync Auvo/UI existentes | Tabela cresce mais | **Escolhida** — mesmo racional do ADR-0009 (E01-S76): estender em vez de fragmentar |
| Nova tabela `pcm.os_hub` | Isolamento "conceitualmente limpo" | Duplica estado operacional ou vira só view sem motivo de ser tabela | Rejeitada |
| Prioridade gravada em coluna | Leitura mais barata | Precisa de cron de promoção; risco de silêncio (padrão já visto no incidente de E00-S11) | Rejeitada |

## Consequências
**Positivas:**
- Uma fila só — não há dois lugares pra saber o estado de uma OS.
- Prioridade nunca fica desatualizada (é sempre recalculada na leitura).
- `pmoc_schedule_id` prepara o link OS↔PMOC sem exigir migration nova quando o produtor (Edge
  Function `pmoc-auvo-create-os`) for construído.

**Negativas / trade-offs aceitos:**
- `melhoria`/`outro` (categorias existentes) ficam fora do Hub — não recebem `tipo_os`/prioridade
  Hub. Aceito: essas categorias não são fila urgente por definição.
- "Dias preventivos" do blueprint não é atendido nesta story — feature futura, sinalizada.
