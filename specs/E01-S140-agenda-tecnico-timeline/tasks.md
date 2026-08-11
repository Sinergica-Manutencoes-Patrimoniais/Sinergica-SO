---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agenda do Técnico: visão timeline por técnico

> Tier pequeno. Segunda visão dos mesmos dados de E01-S104/S112 — sem migration, sem novo endpoint.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio: `agruparAlocacoesPorTecnico` (linha por técnico com alocação, ordem alfabética, "sem técnico" N/A aqui pois toda alocação tem técnico) | AC-2 | vitest | done |
| 2 | UI: toggle "Por dia" / "Por técnico" no topo da página (estado local, default "Por dia") | AC-1 | typecheck | done |
| 3 | UI: grid timeline (linha=técnico, coluna=dia seg-sáb), célula com alocações do dia, célula vazia, cor por técnico via `corDoTecnico` | AC-2,AC-3,AC-4 | typecheck | done |
| 4 | Ligar clique na alocação/célula vazia ao modal existente + navegação de semana | AC-5,AC-6 | typecheck | done |

## Plano de teste
- Unidade: `agruparAlocacoesPorTecnico` — agrupa corretamente, ordena por nome, ignora técnico sem
  alocação na semana.
- Aceite manual (dev server): alternar toggle, ver mesma semana nas duas visões, cor consistente,
  clique abre modal, navegação de semana funciona nas duas visões.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] typecheck/vitest locais verdes
- [ ] ROADMAP.md + STATE.md atualizados
