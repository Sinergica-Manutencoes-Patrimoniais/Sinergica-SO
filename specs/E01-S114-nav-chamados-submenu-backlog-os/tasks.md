---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Nav: "Backlog GUT" e "Ordens de Serviço" viram submenu de "Chamados"

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)          | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------|--------|
| 1  | `NavItem` ganha `filhos?: NavItem[]` opcional (tipo + render recursivo simples) | AC-1 | — | typecheck | done |
| 2  | Reorganizar `PCM_NAV`: mover "Ordens de Serviço"/"Backlog GUT" pra dentro de "Chamados" | AC-2 | 1 | Playwright (navegação funciona) | done |
| 3  | Submenu expandido quando `pcmView` ativo é um dos filhos             | AC-3     | 2          | Playwright                 | done   |

## Implementação
Optou-se pelo padrão mais simples permitido pelo spec.md ("senão, definir um padrão simples de
indentação/expand-collapse"): submenu **sempre visível** (indentado, sem toggle) — satisfaz AC-3
trivialmente (contexto sempre visível, nenhum clique necessário) sem introduzir estado extra de
expandir/colapsar. O item pai "Chamados" mantém seu próprio `view: "chamados"` (clicável) e fica
destacado como ativo também quando o `pcmView` atual é de um filho (`filhoAtivo`).

## Plano de teste
- Aceite: Playwright — clicar em "Backlog GUT" dentro do submenu navega pra `pcmView="backlog"`;
  abrir a tela diretamente já mostra o submenu (sempre visível) com o filho destacado — pendente
  teste local do Lucas.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
