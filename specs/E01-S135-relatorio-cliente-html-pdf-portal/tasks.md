---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Relatório do cliente (HTML + PDF + Portal)

> Tier médio (cross-cutting PCM + Portal E09; migration pra relatórios publicados com RLS). Publicar
> no portal exige isolamento por cliente (RLS FORCE) — segurança é AC, não detalhe.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Domínio `relatorio-cliente.ts`: monta passado (trabalho+evidências) + futuro (cronograma) por cliente/período | AC-1,AC-2,AC-3 | — | vitest | done |
| 2 | Application/adapters: OS executadas+evidências, PMOC/inspeções, cronograma (PMOC/agenda/OS planejadas) por cliente/período | AC-2,AC-3 | 1 | typecheck | todo |
| 3 | UI interna `RelatorioClientePage`: seletor cliente+período, render HTML de apresentação | AC-1 | 2 | typecheck | todo |
| 4 | Exportar PDF (`pdf-lib`) com identidade Sinérgica | AC-4 | 3 | typecheck | todo |
| 5 | Migration: tabela de relatórios publicados por cliente (RLS FORCE, isolamento por condomínio) | AC-5,AC-6 | — | lint:migrations | todo |
| 6 | Publicar: gravar versão imutável + superfície no Portal (E09) pro síndico ver/baixar só o seu | AC-5,AC-6 | 5 | typecheck | todo |
| 7 | Estados vazios (sem passado/sem futuro/sem evidência) | AC-borda | — | vitest | todo |
| 8 | e2e: gerar relatório de um cliente, exportar PDF, publicar; síndico vê só o dele | AC-1..AC-6 | — | playwright (Lucas) | todo |

## Plano de teste
- Unidade: montagem passado/futuro; estados vazios; isolamento (relatório de A nunca aparece pra B).
- Aceite: Playwright — geração interna + PDF; portal mostra só o do cliente (RLS verificada no CI db-tests).

## Riscos / segurança
- RLS FORCE na tabela de relatórios publicados — síndico nunca vê relatório de outro cliente.
- Interno não assume identidade do cliente (mesmo cuidado do 8e/Área do Cliente).

## Checklist de Definition of Done
- [ ] AC verdes pelo gate (vitest/typecheck/biome/lint:migrations)
- [ ] RLS testada (db-tests no CI)
- [ ] Migration aplicada em prod com verificação
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
