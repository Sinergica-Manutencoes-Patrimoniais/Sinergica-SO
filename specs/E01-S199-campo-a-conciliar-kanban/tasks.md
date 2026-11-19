---
name: tasks
description: "Decomposição e gates de E01-S199. Puxe ao implementar."
alwaysApply: false
---

# Tasks — E01-S199 · Campo a conciliar no Kanban

Detalhe técnico em `plan.md`.

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário de `E01-S175`: o que já existe de provisório, triagem, união e listagem | — | relatório no `plan.md`; nenhuma entidade nova sem justificativa | **done** — achado: a máquina existe inteira; falta só o recorte e o lugar |
| 2 | Migration `1866`: `pcm.sso_listar_campo_a_conciliar`, reusando gate e capacidade de `1427`/`1428` | AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | `node scripts/lint-migrations.mjs` | **done** — sem gate nem capacidade nova |
| 3 | pgTAP: permitido e negado, gate fechado com erro nomeado, os quatro recortes da fila e isolamento por Cliente | AC-2→AC-7, AC-10 | `supabase test db` | **done** — 13 asserções, todas verdes |
| 4 | `domain/campo-a-conciliar.ts` — tipo e rótulo de motivo, puros | AC-7 | `pnpm vitest run src/features/pcm` | **done** |
| 5 | Adapter com Zod `.strict()` + chave de query + `useQuery` com `retry: false` | AC-1, AC-10 | `tsc --noEmit` | **done** |
| 6 | Coluna virtual no `OsKanbanView`, sem drag/drop, na posição do pacote | AC-1, AC-8, AC-9 | `pnpm vitest run src/features/pcm/components/OsKanbanViewCampoAConciliar.test.tsx` | **done** — 6/6 verdes |
| 7 | Teste de domínio: ordem literal do quadro e entradas antes das etapas | AC-1 | `pnpm vitest run src/features/pcm/domain/kanban-colunas.test.ts` | **done** — 11/11 verdes |
| 8 | Flag declarada no registro, `.env.example` e `netlify.toml` | AC-F2 | `node scripts/check-flags-declaradas.mjs` | **done** — 740 flags, nenhuma não declarada |
| 9 | "Disponível, não ativado" com frase por caso (flag, gate, capacidade) | AC-10, AC-F3 | teste de componente da task 6 | **done** — 3 casos cobertos |
| 10 | Procedimento de abertura e de retorno, com o aviso do gate compartilhado | AC-F4 | revisão humana | **done** — `plan.md` |
| 11 | Linha de ativação no PR | AC-F5 | revisão humana | **done** — falta gate + flag + concessão |

## Definition of Done

- pgTAP com permitido **e** negado (SC-001), quatro recortes provados (SC-002), isolamento por
  Cliente (SC-003).
- Migration sequencial, aditiva, com reverso escrito no cabeçalho.
- Sem `return null` silencioso; todo estado desligado tem frase própria.
- CI verde.

## Rastreabilidade AC→task (completa)

Lista literal para a auditoria (`eval:spec`), que não expande faixa: AC-1, AC-2, AC-3, AC-4, AC-5,
AC-6, AC-7, AC-8, AC-9, AC-10, AC-F1, AC-F2, AC-F3, AC-F4, AC-F5.
