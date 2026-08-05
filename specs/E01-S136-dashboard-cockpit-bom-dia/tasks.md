---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Dashboard cockpit "bom dia"

> Tier pequeno-médio (agregações + UI, sem migration). **Todos os blocos entram** (4 pedidos + S1-S9);
> o Fabricio dá feedback depois de ver funcionando (o que fica/sai/ajusta).

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio: agregações do dia — OS hoje, alocação técnico→cliente, técnicos livres, chamados sem tratamento (status `aberto` fora de backlog/planejamento/preventiva/planejado) | AC-1..AC-4,AC-6 | vitest | todo |
| 2 | Application/adapters: buscar OS por `data_planejada`=hoje, agenda do dia, técnicos ativos, chamados abertos | AC-1..AC-4 | typecheck | todo |
| 3 | UI: 4 blocos pedidos, acionáveis (clique → tela filtrada), estados vazios | AC-1..AC-5,AC-7 | typecheck | todo |
| 4 | Application/adapters dos blocos S1-S9 (C1/SLA, atrasadas, capacidade, PMOC, backlog, saúde, ontem, inspeções, ferramentas) | AC-8 | typecheck | todo |
| 5 | UI: os 9 blocos sugeridos, cada um acionável (clique → tela filtrada) | AC-5,AC-8 | typecheck | todo |
| 6 | Regressão: KPIs existentes que continuam não regridem | AC-6 | vitest | todo |
| 7 | e2e: dashboard mostra OS hoje/alocação/livres/sem tratamento; clique navega | AC-1..AC-5 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: "sem tratamento" (aberto fora dos estados tratados); técnicos livres = ativos − alocados hoje; OS de hoje por data local.
- Aceite: Playwright — blocos com números certos, cliques navegam, dia vazio mostra estado positivo.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Todos os blocos (4 pedidos + S1-S9) presentes; feedback do Fabricio coletado pós-entrega
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
