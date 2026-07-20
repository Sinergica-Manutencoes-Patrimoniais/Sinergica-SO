---
name: spec-E01-S07-hub-de-os
description: Contrato — classificação de tipo de OS (C1/C2/P1/P2/IN) e prioridade calculada do Hub.
alwaysApply: true
tier: arquitetural
---

# Spec — E01-S07: Hub de OS (fila unificada)

> Arquitetura em [design.md](design.md) / [ADR-0010](../../docs/adr/0010-hub-de-os-estende-ordens-servico.md):
> estende `pcm.ordens_servico`, prioridade sempre calculada.

## Resumo
Classifica toda OS num dos 5 tipos do Hub (C1 emergencial, C2 corretiva, P1 preventiva PMOC, P2
preventiva predial, IN inspeção/follow-up) com SLA e prioridade de fila próprios, sem fragmentar a
fila operacional existente (`pcm.ordens_servico`). Prioridade é sempre recalculada — nunca fica
desatualizada quando uma P1 atrasa.

## Critérios de aceite

**AC-1 — Classificação automática na criação.** Given uma OS nova, When persistida, Then `tipo_os` é
inferido de `categoria` (`emergencial→C1`, `corretiva→C2`, `preventiva→P1` se tiver
`pmoc_schedule_id` senão `P2`, `inspecao→IN`, `melhoria`/`outro`→ sem tipo, fora do Hub).

**AC-2 — Prioridade calculada, nunca gravada.** Given uma OS com `tipo_os`, When a prioridade Hub é
lida, Then é **sempre** recalculada por `calcularPrioridadeHub(tipoOs, dataAgendada, hoje)` — nunca
lida de uma coluna. `C1→1`, `C2→2`, `P1` com `dataAgendada < hoje→2` (atrasada = risco legal),
`P1` com `dataAgendada >= hoje→3`, `P2→3`, `IN→4`.

**AC-3 — SLA por tipo.** Given uma OS classificada, When o prazo é calculado, Then: `C1` = 4h desde
`created_at`; `C2` = 72h desde `created_at`; `P1`/`P2` = janela de ±3 e ±7 dias em torno de
`data_agendada`, respectivamente; `IN` = sem prazo fixo (usa `data_agendada` se houver, senão
indefinido).

**AC-4 — Override manual do tipo.** Given uma OS já classificada, When o usuário `pcm:escrita` edita
manualmente o `tipo_os`, Then o valor editado prevalece — a inferência de AC-1 só roda na criação,
nunca sobrescreve edição manual.

**AC-5 — Fora do Hub não quebra nada.** Given uma OS `melhoria`/`outro` sem `tipo_os`, When exibida
nas telas existentes (Kanban/Timeline/Calendário/Backlog), Then continua funcionando exatamente como
hoje — o Hub é um recorte/badge adicional, não substitui o que já existe.

**AC-6 — Visão do Hub na tela de OS.** Given a lista de Ordens de Serviço, When o usuário filtra por
"Hub", Then vê a fila ordenada por prioridade calculada (1→4), com badge do tipo e indicação de
atraso quando P1 estiver vencida.

## Casos de borda
- OS sem `data_agendada` e `tipo_os='P1'`/`'P2'` → nunca "atrasada" (sem data, sem como comparar);
  entra na fila com a prioridade "no prazo" (3), não crasheia o cálculo.
- `pmoc_schedule_id` setado numa OS com `categoria` diferente de `preventiva` (dado inconsistente,
  não deveria acontecer) → a inferência prioriza `categoria` (regra determinística simples); não é
  validado como erro bloqueante, é só um caso que a função trata sem lançar.

## Fora de escopo (vinculante)
- **"Dias preventivos"** (alocação de técnico por dia da semana) — feature própria futura (design
  Decisão 5 / ADR-0010).
- **Produtor de `pmoc_schedule_id`** (Edge Function `pmoc-auvo-create-os` criando OS a partir do
  cronograma PMOC) — coluna pronta, função deferida pro bloco de Edge Functions (junto de S05).
- Reconstrução do Kanban/Timeline/Calendário existentes — o Hub é uma visão/filtro adicional.

## Rastreabilidade
- Migration: `supabase/migrations/0101_E01-S07_hub_de_os.sql` (`tipo_os`, `pmoc_schedule_id`, aditivas).
- Domínio: `apps/web/src/features/pcm/domain/hub-os.ts` (`inferirTipoOsHub`, `calcularPrioridadeHub`, `calcularPrazoSlaOs`) + `.test.ts`.
- Application/infra: `application/abrir-ordem-servico.ts` (chama `inferirTipoOsHub` na criação), `infrastructure/supabase-ordem-servico-adapter.ts` (persiste/lê `tipo_os`/`pmoc_schedule_id`).
- UI: `pages/OrdensServicoPage.tsx` (filtro/visão "Hub", badge de tipo + prioridade).
