---
name: spec
description: Contrato — gate de consistência de Edge Functions no CI + saúde de sync Auvo visível.
alwaysApply: true
---

# Spec — Guarda-corpos de Edge Functions + saúde de sync

> **Fonte da verdade.** Status: rascunho
> Nasce de um incidente real: assumiu-se que o deploy das Edge Functions rodava pelo git e não
> rodava — a UI dava 404 e **nada avisava**. Esta story fecha o loop de feedback: drift de deploy e
> no-ops silenciosos de sync passam a ser detectáveis (CI vermelho) e visíveis (saúde por entidade).

## Resumo
O CI passa a falhar quando uma Edge Function existe mas não está declarada/invocável, e o estado de
sincronização com o Auvo (write dry-run, cron sem secret, último sucesso/erro por entidade) fica
exposto numa view consultável pela UI, nunca mais mascarado como "ok".

## Critérios de aceite

### AC-1: Função no repo sem declaração falha o CI
- **Dado** uma pasta em `supabase/functions/` (exceto `_shared` e `_template`)
- **Quando** ela **não** está declarada em `supabase/config.toml` (`[functions.<nome>]`)
- **Então** o gate `check-edge-functions` sai com código ≠ 0 e o `ci:local`/pre-push fica vermelho,
  listando o nome da função órfã

### AC-2: `functions.invoke` órfão falha o CI
- **Dado** uma chamada `supabase.functions.invoke("<nome>")` em `apps/web/src`
- **Quando** `<nome>` não corresponde a uma pasta existente em `supabase/functions/` declarada em `config.toml`
- **Então** o mesmo gate falha, apontando arquivo e nome invocado (pega o caso `pcm-auvo-tickets-referencia`)

### AC-3: No-op silencioso vira erro observável
- **Dado** o drain `pcm-auvo-push` encontra descriptor `writeEnabled=false`, **ou** um cron Auvo roda
  sem os Vault secrets (`auvo_trigger_*`)
- **Quando** essa condição ocorre
- **Então** ela é registrada como **erro/skip explícito** (não `status='sent'`/silêncio) numa fonte
  consultável, com timestamp e motivo — jamais contabilizada como sincronização bem-sucedida

### AC-4: Saúde de sync por entidade exposta
- **Dado** a view `pcm.auvo_sync_health` (ou RPC equivalente)
- **Quando** consultada por um papel autorizado
- **Então** retorna, por entidade: `write_enabled`, `last_push_ok_at`, `last_pull_ok_at`,
  `last_error_at`, `last_error` — suficiente para um badge no header do PCM e para debug

## Casos de borda e erros
- Pasta `_shared`/`_template`/`_examples` nunca é tratada como função (allowlist explícita no gate).
- `functions.invoke` com nome dinâmico (variável, não literal) → o gate ignora (não dá falso positivo)
  e loga um aviso de "não verificável estaticamente".
- Entidade sem nenhum push/pull ainda → colunas de timestamp `null`, não erro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Deploy em si das funções e smoke-test pós-deploy — isso é `E01-S35`.
- Alertas/notificação externa (e-mail/Slack) sobre linhas `error` — reconciliação manual por ora.
- Retry automático de linhas `error` do outbox.

## Rastreabilidade
- Product: `./product.md`
- Relacionadas: `E01-S35` (deploy + smoke-test), `E01-S36` (write path que popula a saúde),
  `E01-S22` (`pcm.auvo_sync_outbox`, `pcm-auvo-push`).
