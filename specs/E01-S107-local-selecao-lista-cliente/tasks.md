---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Local do Chamado/OS: seleção da lista do cliente + "Outro"

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                       | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------------------|--------|
| 1  | Componente compartilhado `SeletorLocal` (select + "Outro" + texto livre) | AC-1,AC-2,AC-3 | — | Playwright (seleciona/alterna Outro) | todo |
| 2  | Ligar em `NovoChamadoModal` (ChamadosPage.tsx)                       | AC-1,AC-2,AC-3,AC-5 | 1 | Playwright                            | todo   |
| 3  | Ligar em `NovaOrdemServicoModal`                                     | AC-4,AC-5 | 1          | Playwright                            | todo   |

## Plano de teste
- Aceite: Playwright — cliente com Locais mostra lista; cliente sem Locais mostra só "Outro"; trocar
  cliente reseta seleção; valor gravado bate com o texto esperado nos dois casos (lista/Outro).

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
