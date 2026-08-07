---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Tema escuro real e acessibilidade

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|-------------------------------------------------------------------|----------|------------|------------------------------------------|--------|
| 1  | Tema padrão segue `prefers-color-scheme`; escolha explícita persiste e vence | AC-2 | — | `pnpm run test -- theme-context`          | todo   |
| 2  | Transição suave de brilho na troca de tema                        | AC-2     | 1          | `pnpm run test -- theme-context`          | todo   |
| 3  | Logo troca positivo/negativo com o tema (`App.tsx`, login, menu)  | AC-1     | 1          | `pnpm run e2e -- logo-tema`               | todo   |
| 4  | Cores de gráfico via token resolvido, não hex                     | AC-1     | —          | `pnpm run test -- grafico-cor`            | todo   |
| 5  | Anel de foco contrastante inclusive sobre botão laranja           | AC-3     | —          | `pnpm run test -- foco-visivel`           | todo   |
| 6  | `scripts/check-div-clicavel.mjs` (`onClick` sem `role`+`tabIndex`) | AC-4    | —          | `node scripts/check-div-clicavel.mjs`     | todo   |
| 7  | Corrigir os `div` clicáveis encontrados                           | AC-4     | 6          | `node scripts/check-div-clicavel.mjs`     | todo   |
| 8  | Semântica de tabela/aba/alternador/diálogo nas primitivas         | AC-4     | —          | `pnpm run test -- ui/semantica`           | todo   |
| 9  | Regiões `aria-live` de status e erro + `aria-describedby` de campo | AC-5    | 8          | `pnpm run test -- ui/anuncios`            | todo   |
| 10 | Área de toque mínima 44×44 + separação de 8px no móvel            | AC-7     | —          | `pnpm run e2e -- alvo-toque`              | todo   |
| 11 | Bloco `prefers-contrast: more`                                    | AC-8     | —          | `pnpm run test -- alto-contraste`         | todo   |
| 12 | `@media print` força tema claro                                   | AC-1     | 1          | `pnpm run e2e -- print`                   | todo   |
| 13 | `axe-core` no Playwright, ambos os temas, no CI                   | AC-6     | 7,8,9      | `pnpm run e2e -- axe`                     | todo   |
| 14 | Varredura de contraste nas 56 telas nos 2 temas                   | AC-1     | 4,5        | `pnpm run e2e -- contraste-telas`         | todo   |
| 15 | Percurso de teclado nos 5 fluxos críticos                         | AC-3     | 5,7,8      | `pnpm run e2e -- teclado`                 | todo   |
| 16 | Revisão humana das capturas claro × escuro (registrar no PR)      | AC-1     | 14         | revisão no PR                              | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: `theme-context` respeita e sobrescreve a preferência do sistema; anel de foco visível
  sobre todas as superfícies; cor de gráfico vem de token.
- Contrato (estático): 0 `div` clicável sem semântica.
- Aceite: `axe` sem violação `critical`/`serious` nos 2 temas; contraste ≥ 4.5:1 nas 56 telas;
  5 fluxos críticos completáveis só por teclado; alvo de toque ≥ 44×44 no móvel.

## Nota
O gate humano da task 16 é deliberado. Contraste automático prova legibilidade, não prova que a
tela **parece certa** — e o tema escuro é exatamente onde o automático passa e o olho reprova.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] `axe` no CI, não só local
- [ ] Capturas claro × escuro revisadas e anexadas ao PR
- [ ] `docs/STATE.md` atualizado
