---
name: tasks-acabamento-visual-v1
description: Decomposição e gates do acabamento visual transversal da V1.
alwaysApply: false
---

# Tasks — Acabamento visual V1

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|---|---|---|---|---|
| 1 | Criar primitives CSS compartilhadas e refinar Login/shell | AC-1, AC-2, AC-3, AC-4 | — | `pnpm --filter @sinergica/web typecheck` | done |
| 2 | Refinar páginas e catálogos PCM restantes | AC-1, AC-4, AC-5 | 1 | `pnpm --filter @sinergica/web test` | done |
| 3 | Refinar dashboard, inbox e configurações de Atendimento | AC-1, AC-3, AC-4, AC-5 | 1 | `pnpm --filter @sinergica/web test` | done |
| 4 | Refinar telas de usuários/grupos e estados globais | AC-1, AC-4, AC-5 | 1 | `pnpm --filter @sinergica/web build` | done |
| 5 | Adicionar testes estruturais e smoke visual autenticado | AC-2, AC-3, AC-4, AC-6 | 1, 2, 3, 4 | `pnpm --filter @sinergica/web test` | done |
| 6 | Validar regressão, segurança e rastreabilidade | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 5 | `pnpm run ci:local && pnpm audit --prod --audit-level=high` | done — gates reexecutados de forma independente (Claude, 2026-07-11): typecheck/test/build/arch:check/check:edge-functions/lint:migrations/audit(0 vuln) verdes; `lint` full-tree OOM de máquina (rodado nos 42 arquivos tocados: limpo); `audit:esteira` segue vermelho só pelos 6 arquivos pré-existentes `.agents/skills/*`, fora do escopo desta story |

## Plano de teste
- Unidade: invariantes dos componentes/classes visuais compartilhados.
- Integração: typecheck e build de todas as páginas navegáveis.
- Aceite: smoke autenticado em desktop e viewport estreita, console sem erro novo.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável — CI funcional verde (reverificado por Claude,
      2026-07-11); `audit:esteira` global fica vermelho só por débito pré-existente fora de escopo
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Spec reflete o construído
- [x] `docs/STATE.md` atualizado
- [ ] Commit/push/PR — aguardando confirmação explícita (branch atual não segue convenção de nome)
