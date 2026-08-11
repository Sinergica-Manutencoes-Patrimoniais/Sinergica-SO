---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Chamados/OS: ocultar registros de ponto (INICIO/FIM VISITA)

> Tier trivial-pequeno. Um predicado no domínio + 3 pontos de uso na página de Chamados e OS.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Domínio: `ehOsRegistroVisita(titulo)` — normaliza (trim + lowercase) e compara com "inicio visita"/"fim visita" | AC-1,AC-5 | vitest | done |
| 2 | Aplicar filtro em `filtrarOrdens` — ponto único usado por `ordensFiltradas` em `OrdensServicoPage.tsx` (board/lista/timeline/calendário) | AC-1 | vitest | done |
| 3 | Aplicar filtro em `calcularKpisOrdens` e `calcularMetricasOperacao` (defesa em profundidade — também usadas pelo cockpit `dashboard-pcm.ts`, E01-S136) | AC-2 | vitest | done |
| 4 | Aplicar filtro em `listarBacklogGut` (`application/hub-os.ts` — é a função real usada por `BacklogGutPage.tsx`; `filtrarBacklogGut` do domínio também recebeu o filtro por consistência, mas está sem uso hoje) | AC-3 | vitest | done |
| 5 | Migration `0173_E01-S142`: `fn_kpis_ordens_servico` (RPC server-side, migration 0076) exclui os mesmos títulos — sem isso o KPI padrão (sem busca/filtro de cliente) ficaria inconsistente com o board client-side. **SPEC_DEVIATION SD-1**: spec original não previa migration (tier "sem migration"); necessária porque os KPIs padrão vêm de RPC agregada, não do array filtrado no cliente | AC-2 | leitura de SQL — aplicar com `supabase db diff`/`db push` (Lucas revisa antes de produção) | done (arquivo) / pendente aplicar em produção |
| 6 | Confirmar que `apontamento-horas.ts`/`RelatorioDiarioPage.tsx` não importam nem usam o novo predicado | AC-4 | leitura de código | done |

## Plano de teste
- Unidade: `ehOsRegistroVisita` — match exato normalizado, não-match em títulos parecidos mas
  diferentes, case/espaço tolerantes.
- Unidade: `calcularKpisOrdens`/`filtrarBacklogGut` com uma OS "INICIO VISITA" na lista de entrada —
  não conta/não aparece na saída.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] typecheck/vitest locais verdes
- [ ] ROADMAP.md + STATE.md atualizados
