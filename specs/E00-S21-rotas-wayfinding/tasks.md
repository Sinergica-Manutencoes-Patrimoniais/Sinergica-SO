---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Rotas reais e wayfinding

> **Bloqueada até `design.md` ser aprovado.** Tier arquitetural: decisão difícil de reverter
> (mapa de URL vira contrato público) e toca o gate anti-vazamento de bundle do portal (E09-S11).

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                            | Status |
|----|---------------------------------------------------------------------|----------|------------|--------------------------------------------|--------|
| 0  | `design.md` — mapa das 56 rotas, splitting, `nav-guard`, isolamento do portal | todos | — | revisão `@architect`                        | todo   |
| 1  | Árvore de rotas declarativa (`routes.tsx`) espelhando o menu atual  | AC-1     | 0          | `pnpm run test -- rotas-mapa`               | todo   |
| 2  | `HomePage` vira layout com `<Outlet />` (menu + chrome)             | AC-8     | 1          | `pnpm run test -- home-layout`              | todo   |
| 3  | Migrar sub-navegação PCM (`PcmView`) para rota                      | AC-1     | 1,2        | `pnpm run e2e -- rotas-pcm`                 | todo   |
| 4  | Migrar Financeiro (`FinanceiroView`) `[P]`                          | AC-1     | 1,2        | `pnpm run e2e -- rotas-financeiro`          | todo   |
| 5  | Migrar Atendimento + Config + Guia + Área do Cliente `[P]`          | AC-1     | 1,2        | `pnpm run e2e -- rotas-demais`              | todo   |
| 6  | Parâmetro de registro na URL (cliente, OS, chamado, conversa)       | AC-2     | 3,4,5      | `pnpm run e2e -- rotas-detalhe`             | todo   |
| 7  | Filtros de lista em query string (só os que mudam o que se vê)      | AC-4     | 3,4,5      | `pnpm run e2e -- rotas-filtro`              | todo   |
| 8  | Guarda de rota por permissão + tela de acesso negado nomeada        | AC-5     | 1          | `pnpm run test -- rota-permissao`           | todo   |
| 9  | Tela 404 do produto com caminho de volta                            | AC-5     | 1          | `pnpm run e2e -- rota-404`                  | todo   |
| 10 | `nav-guard` passa a interceptar rota (formulário sujo)              | AC-3     | 2          | `pnpm run test -- nav-guard`                | todo   |
| 11 | Migalha + `document.title` + item ativo derivados da rota           | AC-6     | 2          | `pnpm run e2e -- migalha`                   | todo   |
| 12 | `React.lazy` por módulo + estado de carregamento de rota            | AC-7     | 3,4,5      | `pnpm run build && node scripts/check-bundle.mjs` | todo |
| 13 | Retomar a rota após re-login em sessão expirada                     | AC-3     | 8          | `pnpm run e2e -- sessao-expirada`           | todo   |
| 14 | Rewrite SPA no Netlify (`/*  /index.html  200`)                     | AC-1     | 1          | `pnpm run e2e -- url-profunda`              | todo   |
| 15 | Provar que o bundle do portal continua sem rota interna (E09-S11)   | AC-5     | 1          | `pnpm run check:bundle-portal`              | todo   |
| 16 | `scripts/check-homepage-tamanho.mjs` (< 300 linhas, 0 import de feature) | AC-8 | 2,3,4,5   | `node scripts/check-homepage-tamanho.mjs`   | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: mapa de rotas cobre as 56 telas; guarda de permissão nega e nomeia o módulo;
  `nav-guard` bloqueia troca de rota com formulário sujo.
- Contrato (estático): `HomePage.tsx` < 300 linhas sem import de feature; bundle do portal sem
  rota interna; bundle de entrada < 60% do atual.
- Aceite: Playwright — F5 mantém a tela; voltar não sai do sistema; URL de detalhe reabre o
  registro; filtro sobrevive à recarga; URL profunda não dá 404 no Netlify.

## Risco
Story de maior superfície do lote. **Não fazer em um PR.** Sequência sugerida:
`0→1→2` (fundação, PR 1) · `3` (PCM, PR 2) · `4` · `5` · `6–11` · `12–16` (fechamento).
A regressão mais provável é o gating de permissão: hoje ele vive espalhado em `usePermissoes`
dentro de cada página, e passa a existir **também** na rota — os dois precisam concordar, e
nenhum dos dois pode ser removido (defesa em profundidade; a RLS continua sendo o controle real).

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] `design.md` aprovado **antes** da task 1
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] ADR do mapa de URL registrado (contrato difícil de reverter)
- [ ] Isolamento do bundle do portal (E09-S11) sem regressão
- [ ] `docs/STATE.md` atualizado
