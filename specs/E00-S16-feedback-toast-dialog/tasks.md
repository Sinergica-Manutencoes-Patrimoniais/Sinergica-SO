---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Sistema de feedback: toast + diálogo de confirmação

## Plano
| #  | Task                                                                       | Cobre AC | Depende de | Gate (comando)                              | Status |
|----|----------------------------------------------------------------------------|----------|------------|----------------------------------------------|--------|
| 1  | `ToastProvider` + `useToast` (fila, empilhamento máx. 3, `aria-live`)      | AC-2     | —          | `pnpm run test -- ui/Toast`                   | todo   |
| 2  | `Toast` visual (4 tones, dispensar por clique e swipe, entra/sai mesmo lado)| AC-2    | 1          | `pnpm run test -- ui/Toast`                   | todo   |
| 3  | `ConfirmDialog` sobre o `Modal` (foco no cancelar, `loading`, não fecha em erro) | AC-3 | 1          | `pnpm run test -- ui/ConfirmDialog`           | todo   |
| 4  | `useAcaoComDesfazer` — executa já e emite toast com "Desfazer" (8s)        | AC-4     | 1          | `pnpm run test -- acao-desfazer`              | todo   |
| 5  | `scripts/check-dialogos-nativos.mjs` (conta `confirm(`/`alert(`/`prompt(`) | AC-1     | —          | `node scripts/check-dialogos-nativos.mjs`     | todo   |
| 6  | `scripts/check-catch-silencioso.mjs` (catch vazio ou só `console.*` na UI) | AC-5     | —          | `node scripts/check-catch-silencioso.mjs`     | todo   |
| 7  | Migrar os 24 `confirm()` — classificar cada um em destrutivo (AC-3) ou reversível (AC-4) | AC-1, AC-3, AC-4 | 3,4,5 | `node scripts/check-dialogos-nativos.mjs` | todo |
| 8  | Substituir o `alert()` restante por toast de erro                          | AC-1     | 1,5        | `node scripts/check-dialogos-nativos.mjs`     | todo   |
| 9  | Varrer `catch` silencioso na UI e ligar ao toast                           | AC-5     | 1,6        | `node scripts/check-catch-silencioso.mjs`     | todo   |
| 10 | Plugar os dois checkers no pre-push                                        | AC-1, AC-5 | 5,6      | `pnpm run ci:local`                           | todo   |
| 11 | Playwright: excluir registro pede confirmação nomeada; arquivar oferece desfazer | AC-3, AC-4 | 7 | `pnpm run e2e -- feedback`                    | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: fila do toast (máx. 3 + contador), auto-dismiss só em sucesso/info, `ConfirmDialog`
  mantém aberto quando a promise rejeita, `useAcaoComDesfazer` reverte dentro da janela.
- Contrato (estático): 0 diálogo nativo; 0 `catch` silencioso em `pages/`+`components/`.
- Aceite: Playwright — exclusão nomeia o registro; arquivar mostra "Desfazer" e reverte.

## Task 7 — classificação obrigatória antes de migrar
Cada um dos 24 `confirm()` precisa ser lido e marcado como **irreversível** (vira `ConfirmDialog`)
ou **reversível** (vira ação direta + desfazer). Migrar tudo para `ConfirmDialog` seria trocar
uma caixa feia por uma bonita sem resolver o problema real, que é confirmar demais.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Os 24 `confirm()` classificados (tabela no PR)
- [ ] Checkers no pre-push
- [ ] `docs/STATE.md` atualizado
