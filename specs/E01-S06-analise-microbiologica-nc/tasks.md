---
name: tasks-E01-S06-analise-microbiologica-nc
description: Tasks — gestão de microbiologia + NC (gateway/adapter/UI, sem migration).
alwaysApply: false
---

# Tasks — E01-S06: Análise microbiológica e não-conformidades

## Plano
| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 [P] | domain: `validarTransicaoStatusNc(atual, novo)` (aberto→em_andamento→fechado, rejeita pulo) + `.test.ts` | AC-6 | `pnpm test` | ☐ |
| 2 | application/`pmoc-gateway.ts`: `CriarAnaliseMicrobioInput`, `CriarNaoConformidadeInput`, `AtualizarStatusNcInput` + métodos `criarAnaliseMicrobio`/`criarNaoConformidade`/`atualizarStatusNc` na porta `PmocGateway` | AC-1, AC-4, AC-6 | `pnpm typecheck` | ☐ |
| 3 | application/`pmoc.ts`: use-cases `registrarAnaliseMicrobio` (chama `classificarMicrobio` do domínio antes de persistir) / `registrarNaoConformidade` / `avancarStatusNc` (valida transição) + `.test.ts` | AC-1, AC-2, AC-6 | `pnpm test` | ☐ |
| 4 | infra `supabase-pmoc-adapter.ts`: implementa os 3 métodos (insert microbio com status computado; insert NC; update NC status+completed_at) | AC-1, AC-4, AC-6 | `pnpm typecheck` | ☐ |
| 5 | UI `PmocPage.tsx`: modal "Nova análise microbiológica" (campos + preview do status calculado antes de salvar); modal "Nova NC"; badges de severidade/status; botão de avançar status da NC | AC-1, AC-3, AC-4, AC-5, AC-6, AC-7 | `pnpm build` | ☐ |
| 6 | Reconciliar ROADMAP + STATE | — | `pnpm run ci:local` | ☐ |

## Plano de teste
- **Unidade (Vitest):** `validarTransicaoStatusNc` (todas as transições válidas/inválidas);
  `registrarAnaliseMicrobio` usa `classificarMicrobio` corretamente (conforme/não-conforme/pendente,
  `correctiveActionNeeded` setado só quando não-conforme); `avancarStatusNc` rejeita pulo de fase.
- **RLS:** já coberta pelas policies existentes da migration `0023` (`pmoc_microbio_insert`/`pmoc_nc_insert`/`pmoc_nc_update`) — sem migration nova nesta story, sem pgTAP novo necessário.
- **Aceite (manual/Playwright, se houver tempo):** registrar análise não-conforme → aviso aparece;
  registrar NC alta → badge destacado; avançar status até fechado → `completed_at` preenchido.

## Divergências (SPEC_DEVIATION)
(nenhuma — schema e RLS já existiam prontos desde E01-S03; esta story só liga a aplicação que faltava)

## Definition of Done
- [ ] AC-1..AC-7 verdes pelo gate executável (unit + build)
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP + STATE atualizados
- [ ] Notificação real (push/e-mail) explicitamente marcada como fora de escopo, não simulada
