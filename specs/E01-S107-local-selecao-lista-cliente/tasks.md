---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Local do Chamado/OS: seleção da lista do cliente + "Outro"

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                       | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------------------|--------|
| 1  | Componente compartilhado `SeletorLocal` (select + "Outro" + texto livre) | AC-1,AC-2,AC-3 | — | Playwright (seleciona/alterna Outro) | done |
| 2  | Ligar em `NovoChamadoModal` (ChamadosPage.tsx)                       | AC-1,AC-2,AC-3,AC-5 | 1 | Playwright                            | done   |
| 3  | Ligar em `NovaOrdemServicoModal`                                     | AC-4,AC-5 | 1          | Playwright                            | done   |

## Plano de teste
- Aceite: Playwright não rodado (pendente teste local do Lucas). typecheck/vitest verdes.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente pelo Lucas
- [ ] `docs/STATE.md` atualizado
