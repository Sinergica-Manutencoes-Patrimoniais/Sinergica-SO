---
name: tasks
description: Decomposição e gates — Fluxos node-graph (recipes + logs).
alwaysApply: false
---

# Tasks — Fluxos: paridade node-graph

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Domínio de grafo + validação de ciclo/órfão + compat linear | AC-1, AC-4 | — | testes de domínio | feito |
| 2  | Migration `0062` com recipes/logs, RLS e recipe inicial | AC-1,AC-2,AC-3,AC-4 | 1 | pgTAP escrito | feito; execução pendente |
| 3  | Editor `@xyflow` ramificável com criar/remover arestas | AC-1 | 1 | typecheck/build | feito |
| 4  | Recipes copiadas para o novo fluxo | AC-2 | 2 | teste de caso de uso | feito |
| 5  | Logs por conversa gravados pelo agente e exibidos no manager | AC-3 | 2 | teste/build | feito |
| 6  | Compat E02-S07: ausência de aresta explícita mantém ordem linear | AC-4 | 2 | teste domínio + pgTAP escrito | feito |
| 7  | Gates + ROADMAP/STATE | todos | 1–6 | comandos individuais | feito |

## Plano de teste
- Unidade: validação de grafo, compat linear. Integração: recipes (cópia), logs, migração. Componente: editor. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Testes DOM não disponíveis no workspace; editor/logs validados por domínio, typecheck e build.

## Checklist de Definition of Done
- [ ] Todos os AC verdes (falta pgTAP/UAT real)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Fluxos de E02-S07 preservados
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
