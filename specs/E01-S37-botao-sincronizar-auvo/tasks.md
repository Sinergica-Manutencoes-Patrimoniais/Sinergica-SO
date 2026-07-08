---
name: tasks
description: Decomposição e gates — botão global "Sincronizar Auvo".
alwaysApply: false
---

# Tasks — Botão global "Sincronizar Auvo"

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Edge Function `pcm-auvo-sync-all`: orquestra `pcm-auvo-pull` (todas as entidades do cron) + `pcm-auvo-tasks-import`; agrega resultado por entidade; `requireServiceRole` | AC-1, AC-3 | — | `deno test` (mock: chama cada pull uma vez, agrega erros) | done |
| 2  | Declarar `pcm-auvo-sync-all` em `config.toml` (senão E00-S11 barra) | AC-1 | 1 | `node scripts/check-edge-functions.mjs` | done |
| 3  | Adapter no front (`invoke("pcm-auvo-sync-all")`) + estado de progresso/erro por entidade | AC-1, AC-3 | 1 | test do adapter (mock) | done |
| 4  | Botão "Sincronizar Auvo" no header do PCM: dispara, mostra progresso, "última sincronização", desabilita durante execução | AC-1, AC-3 | 3 | test de componente | done |
| 5  | Confirmar que o "Atualizar" por página segue lendo cache local (não chama Auvo) — separar semântica dos dois botões | AC-4 | — | test de componente `PcmDashboardPage` | done |
| 6  | Aceite: após sync, tarefas Auvo aparecem como OS aberta (integra `os-from-task.ts`) | AC-2 | 1 | test de integração (tasks-import cria OS) | done |
| 7  | `pnpm run ci:local` + atualizar ROADMAP/STATE | todos | 1–6 | `pnpm run ci:local` | done |

## Plano de teste
- Unidade (Deno): `pcm-auvo-sync-all` agrega resultados, erro parcial não aborta lote (AC-3).
- Integração: tasks-import via sync-all cria OS `origem='auvo'` (AC-2).
- Componente: botão global vs "Atualizar" por página (AC-1, AC-4); estados de progresso.
- Aceite: 1 teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `pcm-auvo-sync-all` declarada em `config.toml` (gate E00-S11 verde)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
