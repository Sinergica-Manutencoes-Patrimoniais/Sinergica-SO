---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Limpar dados de teste E2E do banco

> Ação em banco compartilhado (linked/produção) — nenhum `DELETE` roda sem revisão prévia do Lucas
> (AC-1/AC-2). Não é uma task pra automatizar sem supervisão.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------------|--------|
| 1  | Query de leitura: inventariar registros com marcadores de teste (`[TESTE E2E]`, nomes usados nos specs) | AC-1 | — | Lucas revisa a lista | todo |
| 2  | Exclusão dos registros aprovados                                     | AC-2     | 1          | Lucas confirma antes de rodar   | todo   |
| 3  | Teardown automático (`afterEach`/`afterAll`) nos specs que criam dado real | AC-3 | —      | Playwright (roda 2x, sem sobra) | todo   |

## Plano de teste
- Verificação manual: rodar a suíte E2E completa 2x seguidas após a task 3 e confirmar que não
  sobra registro novo no banco.

## Divergências (SPEC_DEVIATION)
- [ ] Tasks 1 e 2 não devem ser executadas sozinhas por mim sem o Lucas revisar a lista antes —
  ação destrutiva em banco compartilhado.

## Checklist de Definition of Done
- [ ] Inventário revisado e aprovado antes da exclusão
- [ ] Exclusão feita só do que foi aprovado
- [ ] Teardown automático implementado e testado (2 rodadas sem sobra)
- [ ] `docs/STATE.md` atualizado
