---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Gesto do drawer móvel, interrompível

> Story de decisão: o AC-7 mede o custo real e determina se uma biblioteca de mola entra no
> projeto. **Implementar sem biblioteca primeiro** — medir, depois decidir. Começar pela
> biblioteca torna o AC-7 impossível de responder.

## Plano
| #  | Task                                                                   | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|------------------------------------------------------------------------|----------|------------|------------------------------------------|--------|
| 1  | `useArrastoHorizontal` — Pointer Events + `setPointerCapture` + histórico de posição/tempo | AC-1 | — | `pnpm run test -- arrasto-horizontal` | todo |
| 2  | Deslocamento do ponto agarrado preservado (sem salto ao pegar)         | AC-1     | 1          | `pnpm run test -- arrasto-horizontal`    | todo   |
| 3  | Histerese de 10px + descarte de gesto vertical (rolagem)               | AC-5     | 1          | `pnpm run test -- arrasto-direcao`       | todo   |
| 4  | Cálculo de velocidade na soltura a partir do histórico                 | AC-2     | 1          | `pnpm run test -- arrasto-velocidade`    | todo   |
| 5  | Decisão abrir/fechar pelo sinal da velocidade, posição como desempate  | AC-2     | 4          | `pnpm run test -- arrasto-decisao`       | todo   |
| 6  | Entrega da velocidade para a animação final, sem emenda                | AC-2     | 4,5        | `pnpm run test -- arrasto-decisao`       | todo   |
| 7  | Reagarrar durante a animação, partindo do valor computado              | AC-3     | 6          | `pnpm run e2e -- drawer-interrupcao`     | todo   |
| 8  | Rubber-band no limite de abertura                                      | AC-4     | 1          | `pnpm run test -- arrasto-limite`        | todo   |
| 9  | `pointercancel` e cruzamento de breakpoint devolvem estado válido      | AC-1     | 1          | `pnpm run test -- arrasto-cancelamento`  | todo   |
| 10 | `prefers-reduced-motion` desliga elástico; clique e `Escape` intactos  | AC-6     | 1,8        | `pnpm run test -- drawer-reduced-motion` | todo   |
| 11 | Playwright móvel: arrastar 40% com velocidade de fechar **fecha**; 60% com velocidade de abrir **reabre** | AC-2 | 5,6 | `pnpm run e2e -- drawer-gesto` | todo |
| 12 | **Medir**: contar linhas do gesto e registrar a decisão do AC-7 no PR  | AC-7     | 1–11       | contagem no PR + ADR se estourar          | todo   |
| 13 | Se estourou 120 linhas: ADR substituindo o 0018 + biblioteca sob demanda | AC-7   | 12         | `pnpm run build` (bundle de entrada sem regressão) | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: histerese não compromete direção antes de 10px; velocidade calculada do histórico
  (não do último ponto isolado); decisão respeita o sinal da velocidade contra a posição;
  rubber-band cresce monotonicamente; `pointercancel` sempre termina em estado válido.
- Aceite: Playwright em viewport móvel — os dois cenários cruzados do AC-2 (posição e velocidade
  discordando) e o reagarrar do AC-3.

## Nota sobre o AC-7
O número 120 é um orçamento, não uma meta. O objetivo é obrigar a decisão a ser tomada com
evidência: se o gesto correto for barato, o projeto fica sem dependência; se for caro, a
biblioteca entra com um número justificando, e não por preferência. **Registrar a contagem no PR
mesmo quando ficar abaixo do limite** — é o dado que valida o ADR-0018.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Contagem de linhas do gesto registrada no PR (AC-7)
- [ ] ADR novo criado **apenas se** o orçamento estourou
- [ ] Contrato do drawer em `visual-v1.test.ts` sem regressão
- [ ] `docs/STATE.md` atualizado
