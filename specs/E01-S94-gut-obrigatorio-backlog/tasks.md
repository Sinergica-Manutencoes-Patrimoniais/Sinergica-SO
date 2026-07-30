---
name: tasks-E01-S94-gut-obrigatorio-backlog
description: Decomposição — GUT obrigatório ao enviar Chamado pro Backlog.
alwaysApply: false
---

# Tasks — GUT obrigatório ao enviar Chamado pro Backlog

## Plano
| #  | Task                                                                 | Cobre AC   | Depende de | Gate (comando)   | Status |
|----|-----------------------------------------------------------------------|----------|------------|------------------|--------|
| 1  | `GerarOsModal`: adicionar estado/campos G/U/T (1-5, sem default) só quando `destino === "backlog"` | AC-1     | —          | browser          | done   |
| 2  | Desabilitar "Confirmar" enquanto G/U/T não preenchidos no modo backlog | AC-2     | Task 1     | browser          | done   |
| 3  | `confirmarGerarOs`/`onConfirmar`: repassar G/U/T escolhidos em vez do hardcode `3` | AC-3, AC-4 | Task 1, 2  | `pnpm run typecheck` | done   |

## Plano de teste
- Aceite: modo backlog exige G/U/T antes de habilitar "Confirmar"; modo "Gerar OS" continua sem os campos, default 3/3/3 preservado; OS criada via backlog grava os valores escolhidos.

## Checklist de Definition of Done
- [x] AC-1 a AC-4 verdes
- [x] `pnpm run ci:local` verde
- [x] `docs/STATE.md` + ROADMAP atualizados
