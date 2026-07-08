---
name: spec
description: Contrato — deploy real das Edge Functions Auvo no CD + secrets + registro de webhooks + smoke-test.
alwaysApply: true
---

# Spec — Deploy das Edge Functions Auvo + secrets + webhooks

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (CD/infra)
> ⚠️ **BLOQUEIA TODA A INTEGRAÇÃO AUVO.** Hoje nenhuma Edge Function está deployada: `config.toml`
> não declara nenhuma e o trigger de push do CD está comentado. Toda `functions.invoke` da UI dá 404
> (`pcm-auvo-tickets-referencia` na tela Tickets, `pcm-auvo-users-create` no cadastro de funcionário).

## Resumo
Todas as Edge Functions de `supabase/functions/` passam a ser deployadas automaticamente no merge para
`main`, com secrets presentes, webhooks Auvo registrados, e um smoke-test que **quebra o CI** se
qualquer função não responder — o deploy nunca mais falha em silêncio.

## Critérios de aceite

### AC-1: Toda função é declarada e deployada
- **Dado** o merge em `main`
- **Quando** o CD roda
- **Então** todas as funções em `supabase/functions/` (exceto `_shared`/`_template`) estão declaradas
  em `supabase/config.toml` (`[functions.<nome>]` com `verify_jwt` correto por função) e deployadas no projeto

### AC-2: Função invocada pela UI responde 200
- **Dado** `pcm-auvo-tickets-referencia` deployada e secrets presentes
- **Quando** a tela Tickets a invoca (POST)
- **Então** responde 2xx (não 404) e a tela renderiza os selects em vez de "Failed to send a request to the Edge Function"

### AC-3: Webhooks Auvo registrados pós-deploy
- **Dado** o deploy concluído
- **Quando** `pcm-auvo-webhooks-register` roda uma vez
- **Então** os webhooks Task/User/Customer/Ticket/Equipment ficam registrados no Auvo apontando para
  `pcm-auvo-webhook` (idempotente — rodar de novo não duplica)

### AC-4: Secrets presentes e documentados
- **Dado** o ambiente de produção
- **Quando** uma função Auvo autentica
- **Então** `AUVO_API_KEY`/`AUVO_USER_TOKEN` (secrets de Edge) e `auvo_trigger_project_url`/
  `auvo_trigger_service_role_key` (Vault) estão presentes; um runbook documenta cada um e como setá-lo

### AC-5: Smoke-test pós-deploy quebra o CI em 404
- **Dado** o step de smoke-test no CD
- **Quando** ele pinga cada função declarada após o deploy
- **Então** o job falha (CI vermelho) se **qualquer** função retornar 404 — deploy quebrado não chega ao usuário

### AC-6: Fonte de verdade de deploy é única e explícita
- **Dado** dois mecanismos possíveis (integração nativa Supabase↔GitHub e workflow manual)
- **Quando** o time faz merge
- **Então** o runbook define **um** mecanismo canônico; se ele estiver inativo/desconfigurado, o deploy
  falha explicitamente em vez de aparentar sucesso

## Casos de borda e erros
- Secret ausente em runtime → função retorna erro claro (não 500 opaco) e o smoke-test acusa.
- Nova função adicionada num PR sem entrada em `config.toml` → gate de `E00-S11` barra antes do merge.
- `verify_jwt` errado (função pública marcada como protegida ou vice-versa) → documentar a matriz por função.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Habilitar write path real / flip de `writeEnabled` — isso é `E01-S36`.
- Gate estático de consistência `config.toml`↔`invoke` — isso é `E00-S11`.
- Setar os valores dos secrets em si (ação manual do Lucas no dashboard) — a spec exige presença, não os valores.

## Rastreabilidade
- Product: `./product.md`
- Relacionadas: `E00-S11` (gate estático), `E01-S09` (fundação Auvo), todas as funções `pcm-auvo-*`.
- Arquivos-âncora: `supabase/config.toml`, `.github/workflows/deploy.yml`, `supabase/functions/_shared/auvo/client.ts`.
