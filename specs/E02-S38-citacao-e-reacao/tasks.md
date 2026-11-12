---
name: tasks
description: Decomposição e gates de E02-S38. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S38 · Citação e reação

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `1835` — colunas `citada_*`, CHECK, tabela `reacoes_mensagem`, RLS force + policy | AC-10, AC-11, AC-12 | — | `pnpm run db:test -- citacao_reacao` | todo |
| 2  | RPC `fn_registrar_reacao_evolution` (aplicada / removida / órfã) | AC-6, AC-7, AC-9 | 1 | `pnpm run db:test -- registrar_reacao` | todo |
| 3  | RPC de ingestão resolve `citada_mensagem_id` dentro do canal | AC-1, AC-2 | 1 | `pnpm run db:test -- citacao_resolucao` | todo |
| 4  | Webhook despacha `reacao` para a RPC; prévia e ordem da lista não mudam | AC-6, AC-8 | 2 | `deno test supabase/functions/atendimento-evolution-webhook/reacao.test.ts` | todo |
| 5  | Webhook passa `citacao` na ingestão (contextInfo dentro **e** fora da mensagem) | AC-1, AC-3, AC-5 | 3 | `deno test supabase/functions/atendimento-evolution-webhook/citacao.test.ts` | todo |
| 6  | Texto do Zé ganha prefixo "Em resposta a {autor}" com corte correto | AC-4 | 5 | `deno test supabase/functions/pcm-ze-agent/citacao.test.ts` | todo |
| 7  | `listar-mensagens.ts` traz reações e `citada_*` num round-trip `[P]` | AC-1, AC-6 | 1 | `pnpm vitest run apps/web/src/features/atendimento/application/listar-mensagens.test.ts` | todo |
| 8  | `MensagemBubble.tsx` — bloco de citação clicável e emoji de reação | AC-1, AC-2, AC-3, AC-6, AC-7 | 7 | `pnpm vitest run apps/web/src/features/atendimento/components/MensagemBubble.test.tsx` | todo |
| 9  | Teste de que reação não gera consumo de IA `[P]` | AC-8 | 4 | `deno test ... --filter "reacao nao aciona"` | todo |
| 10 | Glossário: citação, trecho citado, reação | — | — | `grep` em `docs/glossary.md` | todo |

## Plano de teste

- **Unidade:** `citacaoDaMensagem` com `contextInfo` dentro de cada tipo e em `data.contextInfo`;
  `quotedMessage` de texto, imagem com legenda, vídeo, documento, áudio, figurinha; citação de citação
  (só o primeiro nível); `stanzaId` ausente; `stanzaId` de 300 caracteres.
  `reacaoDaMensagem` com emoji normal, emoji composto, emoji vazio, emoji de 40 caracteres,
  `key.id` ausente.
- **DB (pgTAP, `db-tests` não pulado):** uma reação por mensagem (upsert troca, não duplica);
  remoção apaga; reação órfã devolve `'orfa'` sem erro; RLS permitido (atendimento leitura) e negado
  (sem módulo); CHECK recusa `citada_*` em mensagem de saída; reação **não** altera
  `ultima_mensagem_preview`, `ultima_mensagem_em`, `nao_lidas` nem `status`.
- **Integração:** reação a mensagem de conversa encerrada não reabre; reação chegando antes da
  mensagem reagida.
- **Aceite:** um teste por AC-1..AC-12.
- **Smoke real:** de outro celular, responder citando uma mensagem anterior e reagir com 👍; trocar o
  emoji; remover.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`db-tests` **não pulado**)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
