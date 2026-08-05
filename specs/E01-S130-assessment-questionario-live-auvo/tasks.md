---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Assessment: questionário ao vivo (sem conclusão) + re-sync

> Tier pequeno-médio (Edge nova pra fetch ao vivo da Auvo). Deno não roda local. Reusa a IA de
> import (E01-S96/S98) — não simular IA real (mesmo cuidado de S81/S98).

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Edge: buscar checklist da tarefa Auvo por id ao vivo (`_shared/auvo/client.ts`), formato igual ao `mapearQuestionarioParaQuestoes` | AC-1 | — | (deno CI) | todo |
| 2 | Adapter `importarQuestionarioAuvo`: fonte passa a ser o fetch ao vivo (snapshot vira fallback); questoes vazias → erro claro, não no-op | AC-1,AC-2 | 1 | vitest | todo |
| 3 | Domínio/coluna: flag `provisorio` no item de assessment importado antes da conclusão | AC-3 | — | lint:migrations | todo |
| 4 | UI `AssessmentPage`: mensagem de vazio/erro; badge "provisório" nos itens | AC-2,AC-3 | 2,3 | typecheck | todo |
| 5 | Webhook `pcm-auvo-webhook`: ao concluir a tarefa, re-sync do assessment (atualiza itens, marca definitivo, preserva derivações) | AC-4 | 3 | (deno CI) | todo |
| 6 | e2e: importar tarefa não concluída traz itens; sem checklist mostra mensagem | AC-1,AC-2 | — | playwright (Lucas) | todo |

## Plano de teste
- Unidade: questoes vazias → erro; marcação provisório/definitivo; preservação de derivação no re-sync.
- Aceite: Playwright caminho vazio + mensagem; import real com tarefa Auvo em andamento (Lucas, dado real).

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas) — reproduz o "nada acontece" e confirma correção
- [ ] ROADMAP.md + STATE.md atualizados
