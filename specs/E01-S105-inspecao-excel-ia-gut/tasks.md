---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Inspeção: Excel → IA → GUT → chamado

> Feature de IA/LLM: acionar trilha `ia/` com `@prompt-engineer` (prompt versionado + eval +
> defesa a injection no conteúdo da planilha).

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|-------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 1  | Parser de Excel → linhas + preview, com erro específico           | AC-1     | —          | `pnpm test` (unit; casos de coluna faltante)  | done   |
| 2  | Prompt versionado: quebra/tratamento de linha em item de inspeção | AC-2     | —          | eval do prompt em `ia/`                        | done (eval estrutural; modelo real pendente) |
| 3  | Sugestão de GUT pela IA, editável                                 | AC-3     | 2          | `pnpm test` (unit; edição sobrepõe sugestão)  | done local |
| 4  | Confirmação → derivar Chamado (`origem="inspecao"`)               | AC-4,AC-5 | 1,2,3     | teste de aceite (item → chamado)              | done local |
| 5  | Degradação: falha da IA → importação bruta com aviso              | AC-1     | 1          | `pnpm test` (unit do fallback)                | done local |
| 6  | UI: upload, preview, priorização, confirmação                     | AC-1..AC-5 | 1,3,4    | Playwright (fluxo completo)                    | done local; Playwright pendente |

## Plano de teste
- Unidade: parser, fallback, edição de GUT.
- Eval LLM (`ia/`): qualidade da quebra de linha e extração de local.
- Aceite: Playwright do fluxo Excel → itens → GUT → chamado.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Deno CI / OpenRouter real + Playwright pendentes
- [x] Eval estrutural do prompt versionado verde (`pnpm eval:inspecao-excel`)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
