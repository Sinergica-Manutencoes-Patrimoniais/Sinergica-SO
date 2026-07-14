---
name: tasks
description: Decomposição e gates — apontamento de horas por OS/cliente/técnico + custo.
alwaysApply: false
---

# Tasks — E01-S72 · Apontamento de horas

> Marcar owner no ROADMAP. Branch: `feat/E01-S72-apontamento-horas`. **Depende de E01-S68** (sem o
> fix de timezone, as horas por dia saem erradas).

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `0090_E01-S72_apontamento_horas.sql`: RPC `pcm.fn_apontamento_horas(p_inicio date, p_fim date)` — SQL puro (`language sql stable`), SECURITY INVOKER (RLS de `ordens_servico`/`clientes`/`funcionarios` já cobre); devolve linhas BRUTAS (`duracao_horas`, `check_in_at`, `check_out_at` — o cálculo de horas fica no domínio, não duplicado em SQL); grant execute authenticated | AC-1 | E01-S68 | `pnpm run lint:migrations` | **done** |
| 2 | `domain/apontamento-horas.ts`: `calcularHorasOs` (prioridade `duracaoHoras`; fallback diff de datas, ignora check-out anterior ao check-in; sem dado → 0), `agregarPorCliente`/`agregarPorTecnico`, `calcularCusto` — puro, 8 testes | AC-1, AC-2 | — | `pnpm run test` | **done** |
| 3 | `application/apontamento-horas{-gateway}.ts` + `infrastructure/supabase-apontamento-horas-adapter.ts`: adapter mapeia linha bruta da RPC → `calcularHorasOs` (cálculo real acontece no client, não no banco); `obterApontamentoHoras` orquestra listagem+filtro+agregação | AC-1, AC-2 | 1, 2 | `pnpm run test` | **done** |
| 4 | `ApontamentoHorasPage.tsx`: lista por OS + filtros (período/técnico/cliente) + painéis agregados (por cliente, por técnico); item novo em `HomePage.tsx` (`PCM_NAV`, grupo RELATÓRIOS, ao lado de Laudo SPDA) — única story desta leva que tocou a navegação do HomePage (Kits/Reservas ficaram como seção dentro de página existente; aqui não havia página-mãe natural) | AC-3 | 3 | `pnpm run test` | **done** |
| 5 | Ponte de custo: `buscarValorHora` tenta `financeiro.custos_funcionario` (schema exato não confirmado — E04-S06 não implementada neste repo ainda) e cai em `null` no catch (`PGRST205`/`42P01`/`PGRST106`) — hoje SEMPRE retorna null (esperado, não bug); UI mostra nota "custo disponível quando o módulo Financeiro estiver ativo" | AC-4 | 3 | `pnpm run test` | **done** (degrada corretamente; ativa sozinho quando E04-S06 existir, sem mudança de código aqui) |
| 6 | Gates + ROADMAP/STATE | todos | 1-5 | `biome check --write .`, `typecheck`, `test` (340 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — verificação visual não realizada (sem Playwright neste ambiente) |

## Plano de teste
- Unit: cálculo de horas (durationDecimal, diff de datas, sem dado); agregação.
- Playwright: filtros e totais.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde · revisão adversarial (OS sem check-out; técnico não atribuído) ·
  ROADMAP/STATE atualizados · nota de dependência E01-S68/E04-S06
