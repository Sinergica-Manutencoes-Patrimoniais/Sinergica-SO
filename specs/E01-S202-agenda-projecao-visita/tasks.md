---
name: tasks
description: "Decomposição e gates de E01-S202. Puxe ao implementar."
alwaysApply: false
---

# Tasks — E01-S202 · Agenda do Técnico como projeção da Visita

Detalhe técnico em `plan.md`.

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário: tabela real, colunas, linhas no local, quem escreve, quem lê, caminho da Visita, calendário já derivado | — | relatório no `plan.md` | **done** — `pcm.agenda_tecnico`, 0 linhas; única escrita é a própria tela; `0481` imitado |
| 2 | Migration `1867`: `pcm.sso_listar_agenda_tecnico_projetada`, reusando gate de `1054`/`1063` e capacidade `visita.confirmar` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-8, AC-9 | `node scripts/lint-migrations.mjs` | **done** — sem gate nem capacidade nova |
| 3 | Migration `1867` (2ª metade): comentário de obsolescência + guarda `sso_agenda_tecnico_obsoleta`, sem DROP e sem apagar linha | AC-7 | `node scripts/lint-migrations.mjs` | **done** — aditiva, reverso no cabeçalho |
| 4 | pgTAP: cenário da evidência do cliente (semana com Visita e OS → agenda não vem vazia), permitido e negado, gate fechado nomeado | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | `npx supabase test db supabase/tests/E01-S202_*.test.sql` | **done** — 27 asserções verdes |
| 5 | Ajuste do pgTAP de `E01-S172`: fixture do histórico manual entra com a guarda desligada | AC-7 | `supabase test db` | **done** — S172 e S171 seguem verdes |
| 6 | `domain/agenda-projecao-visita.ts` puro: tipos, semana ISO, agrupamentos, frases distintas por estado | AC-3, AC-6, AC-8, AC-9 | `pnpm vitest run src/features/pcm/domain/agenda-projecao-visita.test.ts` | **done** — 7/7 verdes |
| 7 | Adapter com Zod `.strict()` + chaves em `application/` + `useQuery` com `retry: false` | AC-1, AC-2, AC-6 | `pnpm vitest run src/features/pcm/infrastructure/supabase-agenda-projecao-adapter.test.ts` · `tsc --noEmit` | **done** — 4/4 verdes |
| 8 | `AgendaTecnicoPage` atrás da flag: projeção ligada / cadastro manual desligada | AC-1, AC-2, AC-3, AC-F1, AC-F3 | `pnpm run typecheck` · `pnpm run arch:check` | **done** |
| 9 | Frase em português para a recusa da guarda no formulário manual | AC-7, AC-F3 | teste de domínio da task 6 | **done** — `mensagemDeErroDeAlocacaoManual` |
| 10 | Flag declarada no registro, `.env.example` e `netlify.toml`, com `false` explícito | AC-F2 | `node scripts/check-flags-declaradas.mjs` | **done** |
| 11 | Procedimento de abertura e de retorno, com o aviso do gate compartilhado | AC-F4 | revisão humana | **done** — `plan.md` |
| 12 | Linha de ativação no PR | AC-F5 | revisão humana | **done** — falta gate + concessão `visita.confirmar` + flag |

## Definition of Done

- pgTAP com permitido **e** negado (SC-001); cenário da evidência do cliente provado (SC-002);
  guarda do cadastro antigo com erro nomeado e histórico legível (SC-003).
- Migration sequencial (`1867`), aditiva, com a decisão e o reverso no cabeçalho. Sem `DROP`.
- Sem `return null` silencioso: gate fechado, sem permissão, erro e semana sem Visita têm frases
  diferentes.
- CI verde.

## Rastreabilidade AC→task (completa)

Lista literal para a auditoria (`eval:spec`), que não expande faixa: AC-1, AC-2, AC-3, AC-4, AC-5,
AC-6, AC-7, AC-8, AC-9, AC-F1, AC-F2, AC-F3, AC-F4, AC-F5.
