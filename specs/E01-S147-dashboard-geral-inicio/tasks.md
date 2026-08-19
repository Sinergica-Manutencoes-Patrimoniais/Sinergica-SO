---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Dashboard geral real na tela Início

> Decomposição da implementação. Cada task **mapeia para um ou mais `AC-N`** (rastreabilidade
> spec → task → commit) e tem um **gate executável**: o comando que prova que está pronta.
> Marque `[P]` nas tasks paralelas (sem dependência entre si). Um commit por task.

## Plano
| #  | Task                                                                                                   | Cobre AC        | Depende de | Gate (comando)                                                                 | Status |
|----|---------------------------------------------------------------------------------------------------------|------------------|------------|---------------------------------------------------------------------------------|--------|
| 1  | Extrair `DashboardGeral` de `HomePage.tsx` pra `apps/web/src/app/DashboardGeral.tsx` (componente próprio, testável isolado — `HomePage.tsx` só importa e passa `podeVerModulo`/`navegarModulo`). Sem mudança de comportamento nesta task | — (refactor puro) | —          | `pnpm --filter @sinergica/web test` (suite inteira verde, sem regressão)        | todo   |
| 2  | `features/pcm/application/resumo-inicio-queries.ts` — hook `usePcmResumoInicio(habilitado)` (`useQuery`, `enabled: habilitado`) chamando `supabaseHubOsAdapter.contarKpis()` (RPC leve `fn_kpis_ordens_servico`, devolve `{abertas, emExecucao, criticas, ...}` — não a pipeline pesada de `montarDashboardPcm`) `[P]` | AC-1, AC-7       | —          | `pnpm --filter @sinergica/web typecheck`                                        | todo   |
| 3  | `features/atendimento/application/resumo-inicio-queries.ts` — hook `useAtendimentoResumoInicio(habilitado)` chamando `obterPainelAtendimento` `[P]`                                                     | AC-2, AC-7       | —          | `pnpm --filter @sinergica/web typecheck`                                        | todo   |
| 4  | `features/financeiro/application/resumo-inicio-queries.ts` — hook `useFinanceiroResumoInicio(habilitado)` chamando `obterResumoCaixa`, KPIs formatados com `centavosParaReais` `[P]`                    | AC-3, AC-7       | —          | `pnpm --filter @sinergica/web typecheck`                                        | todo   |
| 5  | `DashboardGeral.tsx`: cada card real usa seu próprio hook (task 2/3/4) direto — nunca um `Promise.all` nem estado de loading compartilhado entre cards. Estado por card: `isLoading` → `Skeleton`; `isError` → mensagem curta + botão "Tentar de novo" (`refetch`); `data` → KPIs do AC-1/2/3 | AC-1, AC-2, AC-3, AC-4, AC-5 | 1, 2, 3, 4 | `pnpm --filter @sinergica/web test -- DashboardGeral`                           | todo   |
| 6  | `DashboardGeral.tsx`: card de Comercial/Marketing/Gestão/Área do Cliente usa `EmptyState` do design system (`variante="vazio"`, texto "Sem dados disponíveis ainda") em vez de ler `DASHBOARD_GERAL` mockado — remove o array `DASHBOARD_GERAL`/tipo `ModuloResumo` de `HomePage.tsx` por completo | AC-6             | 1          | `pnpm --filter @sinergica/web test -- DashboardGeral`                           | todo   |
| 7  | Cada hook (2/3/4) recebe `habilitado = podeVerModulo(<modulo>)` calculado em `DashboardGeral.tsx` — confirma que `enabled:false` não dispara a query (nenhuma chamada de rede/RPC pro módulo sem permissão) `[P]`                                    | AC-7             | 2, 3, 4, 5 | `pnpm --filter @sinergica/web test -- DashboardGeral`                           | todo   |
| 8  | Teste de aceite: clique em "Ver módulo →" em card real e em card vazio chama `onSelect`/`navegarModulo` com o `moduloId` certo — comportamento existente, só confirma que a extração da task 1 não regrediu | AC-8             | 1, 5, 6    | `pnpm --filter @sinergica/web test -- DashboardGeral`                           | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: nenhuma nova (hooks das tasks 2/3/4 são glue trivial sobre função de domínio/aplicação
  já testada — `montarDashboardPcm`/`fn_kpis_ordens_servico`, `montarPainelAtendimento`,
  `obterResumoCaixa` já têm cobertura própria, não duplicar).
- Componente (React Testing Library + Vitest, mesmo padrão do projeto): `DashboardGeral.test.tsx`
  cobre loading independente por card (AC-4), erro contido (AC-5), empty state honesto (AC-6),
  gating por permissão (AC-7) e navegação (AC-8) — mocka os 3 hooks novos, não bate em rede real.
- Aceite: AC-1/2/3 (dado real aparece) verificados no mesmo `DashboardGeral.test.tsx` com mock do
  retorno de cada hook simulando o shape real (`KpiDashboardPcm`, `PainelAtendimento`,
  `ResumoCaixa`) — não é e2e Playwright nesta story (sem credencial de teste disponível nesta
  sessão, ver `docs/STATE.md`); se `SUPABASE_TEST_EMAIL`/`PASSWORD` ficarem disponíveis depois, um
  spec `e2e/dashboard-geral-inicio.spec.ts` fecha a lacuna de verificação visual real.

## Divergências (SPEC_DEVIATION)
> Se a implementação precisar fugir da spec, registre aqui antes de seguir (ver `CLAUDE.md`).
- [ ] <nenhuma no momento da escrita>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADRs de decisões difíceis de reverter registrados (nenhum esperado — reuso, sem decisão nova)
- [ ] Glossário atualizado se mudou (não deve mudar — sem termo novo)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
- [ ] `docs/epics/ROADMAP.md` ganha a linha `E01-S147`
