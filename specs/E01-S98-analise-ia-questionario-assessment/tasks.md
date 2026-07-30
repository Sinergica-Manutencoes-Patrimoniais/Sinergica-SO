---
name: tasks-E01-S98-analise-ia-questionario-assessment
description: Decomposição — análise IA no import de questionário Auvo do Assessment.
alwaysApply: false
---

# Tasks — Análise IA no import de questionário Auvo (Assessment)

## Plano
| #  | Task                                                                              | Cobre AC | Depende de | Gate (comando) | Status |
|----|----------------------------------------------------------------------------------|----------|------------|----------------|--------|
| 1  | Extrair `linhaItemImportado(item, ctx)` de `criarInspecaoImportada` (reuso, sem duplicar cálculo de score/severidade/fotos) | AC-2   | —          | `typecheck`    | done   |
| 2  | `criarInspecaoImportada` passa a usar o helper extraído (sem mudar comportamento) | —        | Task 1     | `test`         | done   |
| 3  | `importarQuestionarioAuvo`: trocar checagem de idempotência por-pergunta por bloqueio por-importação inteira | AC-3   | —          | `test`         | done   |
| 4  | `importarQuestionarioAuvo`: compor texto de todas as perguntas/respostas/fotos e chamar `processarRelatorioInspecao` | AC-1   | Task 3     | `typecheck`    | done   |
| 5  | `importarQuestionarioAuvo`: inserir itens classificados via `linhaItemImportado` (com `auvo_questao_chave` sintético por item, só pra marcar "veio de questionário") | AC-2, AC-4 | Task 1, 4 | `test`       | done   |
| 6  | Ajustar `assessment.test.ts`/adapter tests pro novo contrato                      | AC-1 a AC-4 | Task 1-5 | `vitest run`   | done   |

## Plano de teste
- Aceite: import de questionário com N perguntas gera itens classificados (GUT real, não "media" fixo); reimportar o mesmo assessment é bloqueado; questionário sem inconformidade não quebra (0 itens, sem erro).

## Checklist de Definition of Done
- [x] AC-1 a AC-4 verdes
- [x] `pnpm run ci:local`-equivalente verde
- [x] `docs/STATE.md` + ROADMAP atualizados
