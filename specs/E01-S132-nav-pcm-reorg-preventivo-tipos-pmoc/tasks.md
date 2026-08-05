---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Reorg nav PCM (Tipos de Tarefa / PMOC / Preventivo)

> Tier trivial (1 arquivo: `PCM_NAV`). Sem migration. Cobre itens 3+7+8.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Mover `Tipos de Tarefa` de CADASTROS → CONFIGURAÇÕES | AC-1 | typecheck | done |
| 2 | Mover `PMOC` de PREVENTIVO → OPERAÇÃO | AC-2 | typecheck | done |
| 3 | Remover o grupo PREVENTIVO (Cronograma/Preventivas — itens mortos sem `view`) | AC-3 | typecheck | todo |
| 4 | Confirmar zero `view`/rota órfã apontando pra itens removidos; ajustar testes de nav | AC-4 | vitest/biome | todo |

## Plano de teste
- Unidade/visual: testes de nav (labels presentes/ausentes) verdes.
- Aceite: Playwright — Tipos de Tarefa em Config, PMOC em Operação, sem grupo Preventivo; PMOC abre igual.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
