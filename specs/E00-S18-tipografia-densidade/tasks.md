---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Escala tipográfica, tracking e densidade

## Plano
| #  | Task                                                                  | Cobre AC | Depende de | Gate (comando)                             | Status |
|----|-----------------------------------------------------------------------|----------|------------|---------------------------------------------|--------|
| 1  | Declarar os 7 degraus (`size`+`line-height`+`tracking`) em `rem`     | AC-1, AC-2, AC-3 | — | `pnpm run test -- escala-tipografica`        | todo   |
| 2  | Teste de contrato: tracking negativo no topo, positivo na base       | AC-2     | 1          | `pnpm run test -- escala-tipografica`        | todo   |
| 3  | `.page-title` sobe para `--text-title`; `.page-subtitle` para `body-sm` | AC-5   | 1          | `pnpm run test -- escala-tipografica`        | todo   |
| 4  | `scripts/check-tipografia.mjs` (`text-[Npx]` arbitrário = 0)         | AC-4     | 1          | `node scripts/check-tipografia.mjs`          | todo   |
| 5  | Codemod `text-[9px]`/`[10px]`/`[11px]` → `--text-micro`/`caption`    | AC-4     | 1,4        | `node scripts/check-tipografia.mjs`          | todo   |
| 6  | Codemod `text-xs`/`sm`/`base`/`lg`/`xl`/`2xl`/`3xl` → degraus nomeados `[P]` | AC-1 | 1,4    | `node scripts/check-tipografia.mjs`          | todo   |
| 7  | `NumeroTabular` (ou utilitário) para KPI/moeda/percentual            | AC-6     | 1          | `pnpm run test -- numero-tabular`            | todo   |
| 8  | Corrigir ordem de heading por página (`h1` único, sem pular degrau)  | AC-5     | 3          | `pnpm run e2e -- headings`                   | todo   |
| 9  | Playwright axe: hierarquia de heading em todas as telas do smoke     | AC-5     | 8          | `pnpm run e2e -- headings`                   | todo   |
| 10 | Playwright: fonte do browser em 125% sem corte nem scroll horizontal | AC-7     | 5,6        | `pnpm run e2e -- zoom-tipografia`            | todo   |
| 11 | Plugar `check-tipografia.mjs` no pre-push                            | AC-4     | 4          | `pnpm run ci:local`                          | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: cada degrau declara os 3 valores; tracking tem o sinal certo por posição na escala;
  `line-height` do topo ≤ 1.15 e do body ≥ 1.5.
- Contrato (estático): 0 `text-[Npx]` arbitrário.
- Aceite: axe para hierarquia de heading; Playwright a 125% sem corte nem scroll horizontal.

## Nota de sequenciamento
Task 6 toca praticamente todo arquivo `.tsx` do projeto. Rodar **depois** de E00-S15 concluída —
migrar a tipografia de um `<button>` cru que vai deixar de existir é trabalho jogado fora.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] `check-tipografia.mjs` no pre-push
- [ ] `docs/STATE.md` atualizado
