---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Movimento, resposta e interrupção

> Dependência fechada em **ADR-0018**: CSS + Web Animations API. **Nenhuma biblioteca de
> animação entra nesta story.** O gesto do drawer virou E00-S23.

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                            | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------------------|--------|
| 1  | Curvas `--ease-out`/`--ease-in-out`/`--ease-drawer` + durações nomeadas | AC-1  | —          | `pnpm run test -- movimento-tokens`         | todo   |
| 2  | `scripts/check-movimento.mjs` (`transition-all` = 0; toda `transition` coberta por `reduced-motion`; 0 import de lib de animação) | AC-1, AC-6 | 1 | `node scripts/check-movimento.mjs` | todo |
| 3  | Bloco global `@media (prefers-reduced-motion: reduce)`               | AC-6     | 1          | `node scripts/check-movimento.mjs`           | todo   |
| 4  | Feedback de pressão no `pointerdown` (`Button` + linha clicável)     | AC-3     | 1          | `pnpm run test -- ui/Button`                 | todo   |
| 5  | Entrada/saída do `Modal` (escala 0.96 + fade, caminho espelhado)     | AC-4, AC-5 | 1        | `pnpm run test -- ui/Modal`                  | todo   |
| 6  | Entrada/saída do `Toast` pelo mesmo lado do swipe                    | AC-4     | 1          | `pnpm run test -- ui/Toast`                  | todo   |
| 7  | `transform-origin` do popover/menu ancorado no gatilho               | AC-4     | 1          | `pnpm run test -- ui/Popover`                | todo   |
| 8  | `useAnimacaoInterrompivel` — lê valor computado e reanima a partir dele | AC-7   | 1          | `pnpm run test -- animacao-interrompivel`    | todo   |
| 9  | Aplicar interrupção em `Modal`, drawer e popover                     | AC-7     | 5,7,8      | `pnpm run e2e -- interrupcao`                | todo   |
| 10 | Auditoria da matriz de frequência — remover/reduzir animação em ação de teclado | AC-2 | 1,4  | `pnpm run test -- movimento-frequencia`      | todo   |
| 11 | Flag de desligar movimento para o Playwright                         | AC-6     | 3          | `pnpm run e2e`                                | todo   |
| 12 | Plugar `check-movimento.mjs` no pre-push                             | AC-1, AC-6 | 2        | `pnpm run ci:local`                           | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: curvas declaradas; `Button` aplica pressão no `pointerdown` e desfaz ao sair;
  `Modal`/`Toast` usam caminho espelhado; `useAnimacaoInterrompivel` reanima do valor computado.
- Contrato (estático): 0 `transition-all`; toda `transition`/`animation` coberta por
  `reduced-motion`; 0 import de biblioteca de animação (ADR-0018).
- Aceite: Playwright — fechar um modal enquanto ele abre não produz salto de posição.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] ADR-0018 respeitado: nenhuma biblioteca de animação no `package.json`
- [ ] `check-movimento.mjs` no pre-push
- [ ] `docs/STATE.md` atualizado
