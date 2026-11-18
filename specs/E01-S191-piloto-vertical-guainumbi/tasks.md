---
name: tasks
description: Decomposição e gates de E01-S191. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E01-S191 · Jornada vertical do piloto Guainumbi

Detalhe técnico em `plan.md`.

## Plano

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Mapear as 9 etapas pros RPCs/tabelas reais já existentes — nenhuma é nova | — | relatório em `plan.md` | **done** |
| 2 | Roteiro pgTAP encadeando as 9 etapas, Cliente de teste descartável | AC-1→AC-8 | `npx supabase@2.114.0 test db supabase/tests/E01-S191_*.test.sql` | **done** — 35 assertions |
| 3 | Marcar etapa 6 (Auvo) como duplo de teste, explícito | FR-005, AC-6 | revisão humana | **done** — comentário no teste + `plan.md` |
| 4 | Evidência da execução (versão, ambiente, executor, data, identificadores) | AC-9 | revisão humana | **done** — mensagens de asserção + `plan.md` |
| 5 | Abertura e retorno dos gates tocados, dado produzido sobrevive | AC-10 | pgTAP da task 2 | **done** — mesma transação, gates fecham no fim, OS/Chamado permanecem |

## Definition of Done

- As nove etapas passam numa execução, ambiente limpo, sem intervenção manual (SC-001). **Feito.**
- Evidência suficiente pro critério 11 (SC-002). **Feito** — ver `plan.md`.
- Abertura e retorno de gates na mesma execução (SC-003). **Feito.**
- Relatório diz sem ambiguidade o que é real vs. duplo (SC-004). **Feito** — etapa 6 marcada.

## Fora de escopo (confirmado, não esquecido)

- E2E de browser contra o Auvo real — depende de 16.2-1 (credencial) e esbarraria em SEC-006 se rodado sem isolamento próprio.
- Executar com Cliente real em produção — ato operacional, não entrega de código.

## Rastreabilidade AC→task (completa)

Todas as ACs desta story estão cobertas pelas tasks acima; lista literal pra ferramenta de auditoria (`eval:spec`), que não expande faixa ("AC-1 a AC-4"): AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10.
