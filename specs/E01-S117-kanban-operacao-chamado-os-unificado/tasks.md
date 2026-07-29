---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Operação (Kanban): Chamado e OS são o mesmo item

> Code-only, sem migration (`ordens_servico.status` é texto livre). Fundir tabelas Chamado/OS está
> fora de escopo (2597 linhas prod) — unificação é de UX/apresentação.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)          | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------|--------|
| 1  | `PCM_NAV`/título: "Ordens de Serviço" → "Operação"                   | AC-1     | —          | typecheck                 | done   |
| 2  | Domínio: helper `rotuloNumeroOrdem(ordem)` (CH → CH; senão Auvo #id; senão numero); mapear `localDescricao`/`solicitante`/`origem` no domínio+adapter | AC-2,AC-3,AC-7 | — | `pnpm test` (unit do helper) | done |
| 3  | Card do Kanban usa `rotuloNumeroOrdem` + badge Auvo; Lista/Timeline/Calendário idem | AC-2,AC-3 | 2 | typecheck | done |
| 4  | `domain/kanban-colunas.ts`: coluna `backlog` (status real) na ordem padrão + label | AC-5 | — | `pnpm test` | done |
| 5  | `OsKanbanView`: remove `<select>` de status do card; adiciona "Orientação" truncada; card inteiro clicável → `onSelecionar` | AC-4,AC-6 | 4 | typecheck | done |
| 6  | `DetalheOs` ("Resumo da OS"): adiciona Local/Solicitante/Origem; garante sem duplicar título/cliente/descrição | AC-7 | 2 | typecheck | done |

## Plano de teste
- Unidade: `rotuloNumeroOrdem` (3 casos), `labelColunaKanban("backlog")`, `COLUNAS_KANBAN_PADRAO`
  inclui backlog — verdes em vitest (757 passed).
- Aceite: Playwright — Kanban não mostra "OS-"; coluna Backlog aceita drop; card sem droplist mostra
  orientação; clicar card abre Resumo com Local/Solicitante — pendente teste local do Lucas.

## Ajustes de regressão (e2e)
- 3 specs (`ordens-servico`, `kanban-colunas`, `refinamento-ux`) navegavam por
  `getByText("Ordens de Serviço", exact)` — trocado por `getByTitle("Operação", exact)` (o botão de
  nav tem `title`, evita colisão com o novo `<h2>` "Operação").
- `kanban-colunas.spec` assertava Preventiva adjacente a Corretiva — atualizado pra ordem nova
  (Corretiva → Backlog → Preventiva), mantendo a intenção ("entre Corretiva e Planejamento").

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
