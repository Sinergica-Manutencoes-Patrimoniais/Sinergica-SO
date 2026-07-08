---
name: spec
description: Contrato — propagação instantânea PCM→Auvo em qualquer alteração (todas as entidades).
alwaysApply: true
---

# Spec — Write path instantâneo PCM→Auvo

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (muda semântica de sync; atualiza ADR-0005)
> Hoje só o CREATE de funcionário/ferramenta e a transição de OS→planejamento empurram pro Auvo.
> Todo o resto entra no outbox e morre em `writeEnabled=false` (dry-run permanente). Requisito do Lucas:
> **qualquer alteração no PCM reflete no Auvo imediatamente.**

## Resumo
As entidades espelhadas no Auvo passam a ter `writeEnabled=true` com mapeamento de campos verificado, e o
drain do outbox é **disparado na hora** após cada escrita (não só pelo cron), de modo que create/edit/delete
de funcionário, cliente, equipamento, ferramenta, ticket, serviço etc. propaguem ao Auvo em segundos.

## Critérios de aceite

### AC-1: `writeEnabled=true` faz o drain chamar o Auvo de verdade
- **Dado** um descriptor de entidade com `writeEnabled=true` e mapeamento verificado (AC-4)
- **Quando** `pcm-auvo-push` processa uma linha `pending` dessa entidade
- **Então** executa a chamada real ao Auvo (`POST`/`PATCH`/`DELETE` conforme `op`) e grava
  `auvo_id`/`auvo_sync_status='synced'` na linha de origem (sem loop, via `fn_apply_auvo_sync`)

### AC-2: Alteração na UI dispara o drain imediatamente
- **Dado** um CREATE/EDIT/DELETE de uma entidade registrada feito pela UI
- **Quando** o adapter grava e enfileira no outbox
- **Então** o drain (`pcm-auvo-push`) é invocado **na hora** para aquela linha (não se espera o cron);
  o cron de 1 min permanece só como retry/rede de segurança

### AC-3: Edit e desativar de funcionário propagam
- **Dado** um funcionário já sincronizado (`auvo_id` presente)
- **Quando** ele é editado ou desativado no PCM
- **Então** a mudança propaga ao Auvo (`PATCH`/desativação) — hoje é no-op silencioso

### AC-4: Só habilita entidade com mapeamento verificado
- **Dado** o aviso em `client.ts` de que os nomes de campos da API Auvo nunca foram verificados
- **Quando** uma entidade é marcada `writeEnabled=true`
- **Então** seu mapeamento de campos foi conferido contra a API Auvo real (ou sandbox) e há teste de
  contrato; entidade não verificada permanece `writeEnabled=false` **documentada** (não silenciosa — ver `E00-S11`)

## Matriz de decisão
| Operação na UI | writeEnabled | Mapeamento verificado | Resultado esperado | AC |
|----------------|--------------|------------------------|--------------------|----|
| create/edit/delete | true | sim | drain imediato + chamada Auvo real | AC-1, AC-2 |
| edit/desativar funcionário | true | sim | PATCH/desativação no Auvo | AC-3 |
| qualquer | false | — | skip explícito registrado na saúde de sync (não "ok") | AC-4 |

## Casos de borda e erros
- Drain imediato falha (Auvo 5xx/timeout): linha fica `error`, o cron retenta; a UI não trava nem perde a escrita.
- Duas edições rápidas na mesma linha: idempotência por `auvo_id` (já garantida em E01-S22) evita duplicação.
- Delete de entidade que o Auvo não permite apagar: mapear para desativação, documentar no descriptor.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Deploy das funções e secrets — `E01-S35` (pré-requisito).
- Pull Auvo→PCM e botão de sync — `E01-S37`.
- Reescrever o mecanismo de outbox/anti-loop de E01-S22 — reusar como está.

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` (a criar) · ADR: atualizar `docs/adr/0005-outbox-sync-auvo.md`
- Relacionadas: `E01-S22` (outbox/drain), `E01-S28` (funcionários), `E00-S11` (saúde de sync).
- Arquivos-âncora: `supabase/functions/_shared/auvo/registry/*.ts`, `pcm-auvo-push/index.ts`,
  `apps/web/src/features/*/infrastructure/supabase-*-adapter.ts`.
