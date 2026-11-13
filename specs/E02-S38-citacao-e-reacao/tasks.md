---
name: tasks
description: Decomposição e gates de E02-S38. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S38 · Citação e reação

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `1853` (renumerada de `1835`) — colunas `citada_*`, CHECK, tabela `reacoes_mensagem`, RLS force + policy | AC-10, AC-11, AC-12 | — | `supabase test db` — `citacao_e_reacao.test.sql` (8 asserts) | done |
| 2  | RPC `fn_registrar_reacao_evolution` (aplicada / removida / órfã) | AC-6, AC-7, AC-9 | 1 | idem, testes 5-6-7 | done |
| 3  | RPC de ingestão resolve `citada_mensagem_id` dentro do canal | AC-1, AC-2 | 1 | idem, testes 1-2-3-4 | done |
| 4  | Webhook despacha `reacao` para a RPC; prévia e ordem da lista não mudam | AC-6, AC-8 | 2 | `deno test .../handler.test.ts` (reação não toca `fn_registrar_mensagem_evolution`) | done |
| 5  | Webhook passa `citacao` na ingestão (contextInfo dentro **e** fora da mensagem) | AC-1, AC-3, AC-5 | 3 | idem — classificador (S36) já extraía `citacaoRemoteId` dos dois lugares | done |
| 6  | Texto do Zé ganha prefixo "Em resposta a {autor}" com corte correto | AC-4 | 5 | — | todo (RPC resolve autor; o prefixo formatado pro agente não foi escrito) |
| 7  | `listar-mensagens.ts` traz reações e `citada_*` num round-trip `[P]` | AC-1, AC-6 | 1 | — | todo |
| 8  | `MensagemBubble.tsx` — bloco de citação clicável e emoji de reação | AC-1, AC-2, AC-3, AC-6, AC-7 | 7 | — | todo |
| 9  | Teste de que reação não gera consumo de IA `[P]` | AC-8 | 4 | `deno test .../handler.test.ts` — reação nunca chama `fn_registrar_mensagem_evolution` | done |
| 10 | Glossário: citação, trecho citado, reação | — | — | — | todo |

> **Nota:** "trecho citado" (AC-3, citação de mídia/mensagem fora do sistema mostrar o texto que
> veio junto do evento) **não foi implementado** — a RPC resolve `citada_mensagem_id`/`citada_autor`
> dentro do canal, mas não grava `citada_trecho` a partir do `contextInfo.quotedMessage` do payload.
> A coluna existe e aceita o valor; falta o extrator. Registrado como pendência real.

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
