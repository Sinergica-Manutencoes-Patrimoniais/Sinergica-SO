---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Relatório diário da operação

> Tier pequeno-médio (agregação + PDF, sem migration). Reusa agregações e `pdf-lib`. Sob demanda
> (sem cron).

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio `relatorio-diario.ts`: monta o resumo do dia (números, por técnico, atenção, backlog) a partir dos datasets | AC-1,AC-2 | vitest | done |
| 2 | Application/adapters: buscar OS/chamados/horas/agenda/saúde por data | AC-1,AC-2 | typecheck | todo |
| 3 | UI `RelatorioDiarioPage` (grupo RELATÓRIOS): seletor de data + render das seções | AC-1,AC-4 | typecheck | todo |
| 4 | Exportar PDF (`pdf-lib`) com o mesmo conteúdo | AC-3 | typecheck | todo |
| 5 | Estado "sem movimento" + fallbacks (nome técnico/cliente, saúde indisponível) | AC-4 | vitest | todo |
| 6 | e2e: escolher um dia, ver resumo, exportar PDF | AC-1,AC-3 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: agregação por data; dia vazio; contadores.
- Aceite: Playwright — dia com movimento mostra resumo; PDF baixa; dia vazio mostra mensagem.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
