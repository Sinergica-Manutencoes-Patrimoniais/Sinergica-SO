---
name: tasks-E01-S81-ia-titulo-os-openrouter
description: Decomposição — config IA OpenRouter + geração de título de OS.
alwaysApply: false
---

# Tasks — IA: config OpenRouter + geração de título de OS

## Plano
| #  | Task                                                                  | Cobre AC | Depende de | Gate (comando)            | Status |
|----|-----------------------------------------------------------------------|----------|------------|---------------------------|--------|
| 1  | Aba "IA" na Config (superadmin): API key (Vault) + seletor de modelo   | AC-1     | E01-S80    | browser + RPC retorna ok  | todo   |
| 2  | Prompt de geração de título (`ia/`) — `@prompt-engineer`               | AC-2,3   | —          | revisão de prompt         | todo   |
| 3  | Edge Function `pcm-os-gerar-titulo` (lê segredo interno, chama OpenRouter) | AC-2 | 1,2        | teste Deno + smoke        | todo   |
| 4  | Botão "Gerar título" no `NovaOrdemServicoModal` + validação no domínio | AC-2,4   | 3          | `pnpm test` + browser     | todo   |
| 5  | Auto-título no `pcm-ze-agent` quando `origem='ze'` e sem título        | AC-3,4   | 2,3        | teste Deno                | todo   |
| 6  | Degradação: botão desabilitado/fluxo segue sem IA configurada          | AC-4     | 1,4,5      | `pnpm test`               | todo   |

## Plano de teste
- Unidade: validação/saneamento do título retornado (tamanho, trim) no domínio.
- Integração: Edge Function com key ausente → erro tratado; com key → título.
- Aceite: um teste por AC (config grava no Vault; botão gera; Zé auto-preenche; sem IA não quebra).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde; Edge Function deployada + smoke (não 404)
- [ ] Segredo nunca em tabela/log (confirmado)
- [ ] `docs/STATE.md` + ROADMAP atualizados
