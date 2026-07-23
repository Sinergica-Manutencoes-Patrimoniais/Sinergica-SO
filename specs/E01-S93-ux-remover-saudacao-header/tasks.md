---
name: tasks-E01-S93-ux-remover-saudacao-header
description: Decomposição — remover saudação do header.
alwaysApply: false
---

# Tasks — Remover saudação do header

## Plano
| #  | Task                                              | Cobre AC | Depende de | Gate (comando) | Status |
|----|---------------------------------------------------|----------|------------|----------------|--------|
| 1  | Remover "Olá, {nome}" do header, manter menu conta | AC-1    | —          | browser mobile+desktop | done |

## Plano de teste
- Aceite: header sem saudação em desktop e mobile; menu de conta intacto.

## Checklist de Definition of Done
- [x] AC-1 verde
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
