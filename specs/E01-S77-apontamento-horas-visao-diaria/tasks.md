---
name: tasks-E01-S77-apontamento-horas-visao-diaria
description: Decomposição e gates — visão diária de apontamento de horas.
alwaysApply: false
---

# Tasks — Apontamento de Horas: visão diária por técnico

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|-----------|----------------|--------|
| 1 | Migration: `pcm.funcionarios.jornada_diaria_horas numeric` nullable (aditiva, sem NOT VALID — coluna nova) | AC-6 | — | `pnpm run lint:migrations` | ☐ |
| 2 [P] | domain: `formatarHorasMinutos(decimal): string` (`HHhMMmin`) + `.test.ts` | AC-2, AC-3, AC-4 | — | `pnpm test` | ☐ |
| 3 [P] | domain: `agruparPorDia(itens): DiaTecnico[]` (span, soma, incompleto) + `.test.ts` (INV: OS sem par vira incompleta; cruza meia-noite atribui ao dia do check-in) | AC-1, AC-2, AC-3, AC-4, AC-5 | — | `pnpm test` | ☐ |
| 4 [P] | domain: `sinalizarJornada(diferencaDia, jornadaEsperada): 'ok'\|'falta'\|'hora-extra'\|null` (tolerância 15min) + `.test.ts` | AC-6 | — | `pnpm test` | ☐ |
| 5 [P] | domain: `gerarCsvApontamento(dias): string` + `.test.ts` | AC-7 | 3, 4 | `pnpm test` | ☐ |
| 6 [P] | domain: `agregarPorSemana(itens): TendenciaSemana[]` + `.test.ts` | AC-8 | — | `pnpm test` | ☐ |
| 7 | application: estender `apontamento-horas.ts` (`obterApontamentoPorDia` combina agrupamento + jornada do funcionário) | AC-1..AC-6 | 3, 4 | `pnpm typecheck` | ☐ |
| 8 | infra: `supabase-funcionarios-adapter.ts` estende leitura/escrita de `jornada_diaria_horas`; `supabase-apontamento-horas-adapter.ts` expõe jornada por técnico | AC-6 | 1, 7 | `pnpm typecheck` | ☐ |
| 9 | UI: `FuncionariosPage.tsx` — campo "Jornada diária (horas)" no cadastro | AC-6 | 8 | `pnpm build` | ☐ |
| 10 | UI: aba "Por dia" em `ApontamentoHorasPage.tsx` — tabela (técnico,dia) expansível, badges incompleto/falta/hora-extra | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9 | 7, 8 | `pnpm build` | ☐ |
| 11 | UI: botão "Exportar CSV" na aba "Por dia" | AC-7 | 5, 10 | `pnpm build` | ☐ |
| 12 | UI: sub-visão "Tendência" (tabela/gráfico simples por semana) | AC-8 | 6, 10 | `pnpm build` | ☐ |
| 13 | Playwright: fluxo completo (abrir "Por dia", ver span+soma+lista OS, dia incompleto, exportar CSV) no dev server local | AC-1..AC-9 | 9, 10, 11, 12 | `pnpm exec playwright test` | ☐ |
| 14 | ADR/glossário/ROADMAP/STATE | — | todas | `pnpm run audit:esteira` | ☐ |

`[P]` = paralelizável (funções puras de domínio, sem dependência entre si). Um commit por task.

## Plano de teste
- **Unidade (Vitest):** `formatarHorasMinutos` (arredondamento, zero, negativo nunca ocorre),
  `agruparPorDia` (dia incompleto, meia-noite, sobreposição), `sinalizarJornada` (tolerância,
  sem jornada cadastrada = neutro), `gerarCsvApontamento` (escaping de vírgula/aspas),
  `agregarPorSemana` (limites de semana ISO).
- **Aceite (Playwright, dev server local — Supabase de produção, NUNCA URL Netlify):** abrir aba
  "Por dia", conferir span+soma+lista de OS de um técnico real do período, exportar CSV e conferir
  conteúdo, conferir que a aba antiga (OS no período + agregados) segue idêntica (AC-9).

## Divergências (SPEC_DEVIATION)
- Migration renumerada de `0095` para `0099`: a sessão paralela de E01-S76 consumiu 0095-0098; `lint:migrations` pegou a colisão. Só o número mudou, o conteúdo é o mesmo. Não é desvio de escopo.

## Checklist de Definition of Done
- [x] AC-1..AC-9 verdes (unit + gates + Playwright contra dado real de produção)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Migration da jornada aplicada em produção (`supabase db push`, dry-run antes) — `0099`
- [x] Glossário atualizado ("Jornada esperada", "Diferença do dia")
- [x] `docs/STATE.md` atualizado
- [x] `pnpm run ci:local` verde (typecheck, lint, test 406, build, arch, lint:migrations, esteira, eval:spec)
- [x] Playwright `apontamento-horas-diario.spec.ts` 4/4 + `refinamento-ux.spec.ts` 5/5 (sem regressão)
