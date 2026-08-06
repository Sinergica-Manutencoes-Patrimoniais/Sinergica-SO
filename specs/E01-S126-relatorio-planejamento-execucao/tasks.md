---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Relatório de planejamento e execução

> Tier pequeno (leitura + formatação + PDF; sem migration). O texto/dedupe é domínio puro — nasce
> testável. União de duas fontes exige regra de dedupe explícita (AC-2).

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio `relatorio-planejamento.ts`: união Agenda ∪ OS planejadas + dedupe (chave cliente/local/serviço) + ordenação por hora | AC-2 | vitest | done |
| 2 | Domínio: formatação do texto (Planejamento e Execução) no formato exato do exemplo | AC-3,AC-4 | vitest | todo |
| 3 | Application/adapters: buscar Agenda + OS planejadas por dia/técnico/cliente; anexar execução/link Auvo | AC-1,AC-4 | typecheck | todo |
| 4 | UI `RelatorioPlanejamentoPage` (aba na Operação): filtros dia/técnico/cliente, toggle Planejamento/Execução, render numerado | AC-1,AC-3,AC-4 | typecheck | todo |
| 5 | Botão Copiar (clipboard, texto exato) + Baixar PDF (`pdf-lib`) | AC-5 | typecheck | todo |
| 6 | Estado vazio + fallbacks (sem itens / sem técnico) | AC-borda | vitest | todo |
| 7 | e2e: gerar planejamento de um dia/técnico, copiar, baixar PDF | AC-1,AC-5 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: dedupe (item nas duas fontes → 1×); formatação bate o exemplo caractere-relevante;
  ordenação por hora; execução com/sem link.
- Aceite: Playwright — filtros, copiar, PDF. PDF: verificação estrutural (não pixel).

## Decisão de fonte (2026-08-06)
- A Agenda atual só armazena técnico, cliente, dia e horário; não guarda serviço/local. Portanto,
  itens de Agenda sem descrição não são deduplicados contra OS — eliminar por cliente apenas
  apagaria visitas distintas. Quando existir descrição nos dois lados, a OS substitui a Agenda e
  preserva seu horário.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate (vitest/typecheck/biome)
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
