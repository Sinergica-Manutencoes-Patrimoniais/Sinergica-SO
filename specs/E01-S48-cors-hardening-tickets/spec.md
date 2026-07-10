---
name: spec
description: Contrato — diagnóstico/hardening de CORS na tela de Tickets.
alwaysApply: true
---

# Spec — Diagnóstico/hardening de CORS em Tickets

> **Fonte da verdade.** Status: rascunho · Tier: Trivial
> Feedback de teste manual do Lucas (2026-07-09, ponto 5, com print): tela de Tickets mostra "Failed to
> send a request to the Edge Function". Esse texto é o genérico que o `supabase-js` mostra quando o
> `fetch` falha no browser (CORS bloqueando a resposta) — não quando a function responde erro em JSON.
> `pcm-auvo-tickets-referencia` está corretamente protegida (try/catch completo, deploy confirmado via
> `config.toml`); a causa mais provável é o domínio de produção fora de `CORS_ALLOWED_ORIGINS`.

## Resumo
Não consigo confirmar/corrigir o valor do secret `CORS_ALLOWED_ORIGINS` (fora do meu acesso). O que dá
pra fazer no código: (1) smoke-test que quebra o CI se o domínio de produção não estiver na allowlist,
pegando essa regressão antes do usuário; (2) log na function quando um Origin desconhecido bate, pra
diagnosticar pelos logs da próxima vez; (3) mensagem mais clara no frontend distinguindo falha de
rede/CORS de erro de negócio.

## Critérios de aceite

### AC-1: CI quebra se o domínio de produção não estiver na allowlist
- **Dado** `scripts/smoke-edge-functions.mjs` rodando pós-deploy
- **Quando** uma requisição OPTIONS com `Origin: https://so-sinergica.netlify.app` bate em
  `pcm-auvo-tickets-referencia`
- **Então** o script falha (exit 1) se `Access-Control-Allow-Origin` não ecoar esse origin

### AC-2: Log quando Origin desconhecido bate
- **Dado** `_shared/cors.ts`
- **Quando** um `Origin` não está em `CORS_ALLOWED_ORIGINS`
- **Então** loga um `console.warn` com o origin recebido (visível nos logs da function)

### AC-3: Mensagem de frontend distingue rede/CORS de erro de negócio
- **Dado** `TicketsPage.tsx` falhando ao carregar
- **Quando** o erro é o genérico do `supabase-js` (`FunctionsFetchError`/"Failed to send a request")
- **Então** mostra uma mensagem que não sugere bug de negócio ("não foi possível conectar", recarregar)

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Corrigir o valor do secret `CORS_ALLOWED_ORIGINS` — ação do Lucas no dashboard Supabase, fora do meu
  acesso nesta sessão.
- Mudar a lógica de negócio de `pcm-auvo-tickets-referencia` — já está correta.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Arquivos-âncora: `scripts/smoke-edge-functions.mjs`, `supabase/functions/_shared/cors.ts`,
  `apps/web/src/features/pcm/pages/TicketsPage.tsx`.
