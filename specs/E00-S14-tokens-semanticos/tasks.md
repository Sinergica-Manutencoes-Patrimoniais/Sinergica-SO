---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Tokens semânticos e erradicação de cor hardcoded

## Plano
| #  | Task                                                                                          | Cobre AC | Depende de | Gate (comando)                                     | Status |
|----|-----------------------------------------------------------------------------------------------|----------|------------|----------------------------------------------------|--------|
| 1  | Declarar os 12 tokens de status em `@theme` + overrides em `html[data-theme="dark"]`           | AC-1     | —          | `pnpm run test -- design-tokens`                    | todo   |
| 2  | Escrever `scripts/check-tokens-cor.mjs` (falha se achar hex/`bg-white` em `.tsx` fora do allowlist) | AC-2 | 1          | `node scripts/check-tokens-cor.mjs`                 | todo   |
| 3  | Plugar o checker no `lefthook` pre-push e no `pnpm run ci:local`                                | AC-2     | 2          | `pnpm run ci:local`                                 | todo   |
| 4  | Codemod: substituir os pares da matriz de decisão em `features/pcm/**` (maior volume)          | AC-2     | 1,2        | `node scripts/check-tokens-cor.mjs --dir features/pcm` | todo |
| 5  | Codemod: `features/financeiro/**` `[P]`                                                        | AC-2     | 1,2        | `node scripts/check-tokens-cor.mjs --dir features/financeiro` | todo |
| 6  | Codemod: `features/atendimento/**` + `features/area-cliente/**` + `features/config/**` `[P]`   | AC-2     | 1,2        | `node scripts/check-tokens-cor.mjs --dir features`  | todo   |
| 7  | Codemod: `app/**` (HomePage, PortalShell) `[P]`                                                 | AC-2     | 1,2        | `node scripts/check-tokens-cor.mjs`                 | todo   |
| 8  | Refatorar `prioridadeColor` / `statusOsColor` / similares para devolver token                   | AC-3     | 1          | `pnpm run test -- status-cor`                       | todo   |
| 9  | Helper `tokenCor(nome)` para consumidores que precisam do valor resolvido (gráficos)            | AC-3     | 1          | `pnpm run test -- token-cor`                        | todo   |
| 10 | Teste de contraste WCAG de todos os pares nos 2 temas                                           | AC-5     | 1          | `pnpm run test -- contraste`                        | todo   |
| 11 | Playwright: varredura de "patch claro" com `data-theme="dark"`                                  | AC-4     | 4,5,6,7    | `pnpm run e2e -- dark-mode`                         | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: presença dos 12 tokens + override dark; `prioridadeColor`/`statusOsColor` sem `#`;
  `tokenCor` resolve variável CSS.
- Contrato (estático): `check-tokens-cor.mjs` conta 0 ocorrências do padrão proibido.
- Aceite: contraste ≥ 4.5:1 em todos os pares × 2 temas; varredura Playwright em dark.

## Ordem de execução recomendada
Tasks 1→2→3 primeiro (o checker precisa existir e falhar **antes** dos codemods, senão não há
oráculo). Depois 4–7 em paralelo por diretório — sem conflito de arquivo entre eles.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] `check-tokens-cor.mjs` no pre-push (impede regressão)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado
