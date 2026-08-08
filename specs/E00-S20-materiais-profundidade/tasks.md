---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Materiais, profundidade e chrome

## Plano
| #  | Task                                                                  | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|-----------------------------------------------------------------------|----------|------------|------------------------------------------|--------|
| 1  | 4 degraus de elevação em duas camadas, derivados do navy + override escuro | AC-1, AC-3 | — | `pnpm run test -- elevacao`               | todo   |
| 2  | `scripts/check-sombras.mjs` (`shadow-(sm\|md\|lg\|xl\|2xl)` = 0)      | AC-2     | 1          | `node scripts/check-sombras.mjs`          | todo   |
| 3  | Codemod das 65 sombras para os degraus nomeados                       | AC-2     | 1,2        | `node scripts/check-sombras.mjs`          | todo   |
| 4  | Chrome translúcido no cabeçalho de módulo + barra de ação             | AC-4     | 1          | `pnpm run e2e -- chrome-translucido`      | todo   |
| 5  | `prefers-reduced-transparency` torna o chrome opaco                   | AC-4     | 4          | `pnpm run test -- reduced-transparency`   | todo   |
| 6  | Borda de rolagem condicional (só com conteúdo por baixo)              | AC-5     | 4          | `pnpm run e2e -- borda-rolagem`           | todo   |
| 7  | Separar camada bloqueante (com scrim) de paralela (sem scrim)         | AC-6     | 1          | `pnpm run test -- ui/Modal`               | todo   |
| 8  | Empilhamento de modal com scrim progressivo                           | AC-6     | 7          | `pnpm run test -- ui/Modal`               | todo   |
| 9  | Vibrância: peso/contraste/tracking do texto sobre material            | AC-7     | 4          | `pnpm run test -- contraste-material`     | todo   |
| 10 | `@media print` sem sombra nem desfoque                                | AC-1     | 1          | `pnpm run e2e -- print`                   | todo   |
| 11 | Plugar `check-sombras.mjs` no pre-push                                | AC-2     | 2          | `pnpm run ci:local`                       | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: degraus monotônicos em desfoque e deslocamento; nenhum usa preto puro; override
  escuro existe.
- Contrato (estático): 0 sombra default do Tailwind; 0 sombra arbitrária fora de `components/ui/`.
- Aceite: Playwright — borda de rolagem ausente no topo e presente após rolar; chrome opaco sob
  `prefers-reduced-transparency`; contraste do texto sobre material ≥ 4.5:1.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] `check-sombras.mjs` no pre-push
- [ ] `docs/STATE.md` atualizado
