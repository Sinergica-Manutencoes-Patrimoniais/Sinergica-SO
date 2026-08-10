---
name: tasks
description: Decomposição e gates — funil Kanban do Comercial com etapas configuráveis.
alwaysApply: false
---

# Tasks — E03-S02 · Funil (Kanban) + etapas configuráveis

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03). Ler `spec.md` e o
> `design.md` do épico. Branch: `feat/E03-S02-funil-kanban-etapas`.
> **Depende da E03-S01 estar mergeada** — o schema e o domínio de transição vêm de lá.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `domain/funil.ts`: estender com `podeReceberCard(etapa)` (etapa inativa não recebe), `exigeMotivo(etapa)` e `ultimaEtapaAberta(etapas)` — puras, unit tests incluindo o caso "desativar a última aberta" | AC-4, AC-7 | — | `pnpm run test` | todo |
| 2 | Casos de uso: `moverOportunidade(id, etapaDestino, motivoId?)` com rollback otimista explícito no retorno, `reordenarEtapas`, `desativarEtapa` (recusa a última aberta) | AC-3, AC-5, AC-6, AC-7 | 1 | `pnpm run test` | todo |
| 3 | `FunilPage`: board por etapa ativa, cabeçalho com contagem + soma de valores, coluna com scroll próprio (página nunca rola horizontal) | AC-1 | 2 | `pnpm run test` | todo |
| 4 | Card da oportunidade: Conta, título, valor, responsável, `score`/`lead_tier` quando houver; clique abre Visão 360 na aba Comercial | AC-2 | 3 | `pnpm run test` | todo |
| 5 | Drag-and-drop reusando o padrão já validado no Kanban de OS (E01-S61) — não introduzir biblioteca nova; desabilitado sem `escrita` | AC-3 | 4 | `pnpm run test` | todo |
| 6 | Modal de motivo de perda ao soltar em etapa `perdida`; cancelar devolve o card à origem sem escrever | AC-4 | 5 | `pnpm run test` | todo |
| 7 | Rollback visual em falha de escrita (rede/RLS/trigger) + toast com o erro real | AC-5 | 5 | `pnpm run test` | todo |
| 8 | `ConfigFunilPage`: CRUD + reordenação de etapas e motivos; excluir com oportunidade → bloqueio com oferta de desativar | AC-6, AC-7 | 2 | `pnpm run test` | todo |
| 9 | `pnpm run ci:local` + Playwright (dev server local): arrastar entre colunas, soltar em Perdido e cancelar (card volta), soltar e confirmar com motivo, tentar desativar última etapa aberta + ROADMAP/STATE atualizados | todos | 1–8 | `pnpm run ci:local` | todo |

## Plano de teste
- **Unit**: `podeReceberCard` com etapa inativa; `ultimaEtapaAberta` com 1 e com N; `exigeMotivo`
  só em `perdida`.
- **Playwright**: o cancelamento do modal de perda é o caso que mais quebra na prática — o card
  precisa voltar para a coluna de origem **e** o banco continuar sem `motivo_perda_id`.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Otimismo de UI mostrando estado que o banco recusou (trigger de motivo) | AC-5 com rollback explícito, testado no Playwright |
| Reintroduzir biblioteca de drag-and-drop diferente da usada no PCM | Task 5 exige reuso do padrão da E01-S61 |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: coluna vazia, etapa inativa com card, dois usuários no mesmo card)
- [ ] ROADMAP/STATE atualizados
