---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Nav: "Backlog GUT" e "Ordens de Serviço" viram submenu de "Chamados"

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)          | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------|--------|
| 1  | `NavItem` ganha `filhos?: NavItem[]` opcional (tipo + render recursivo simples) | AC-1 | — | typecheck | todo |
| 2  | Reorganizar `PCM_NAV`: mover "Ordens de Serviço"/"Backlog GUT" pra dentro de "Chamados" | AC-2 | 1 | Playwright (navegação funciona) | todo |
| 3  | Submenu expandido quando `pcmView` ativo é um dos filhos             | AC-3     | 2          | Playwright                 | todo   |

## Plano de teste
- Aceite: Playwright — clicar em "Backlog GUT" dentro do submenu navega pra `pcmView="backlog"`;
  abrir a tela diretamente (deep-link se houver) já mostra o submenu expandido.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md` atualizado
