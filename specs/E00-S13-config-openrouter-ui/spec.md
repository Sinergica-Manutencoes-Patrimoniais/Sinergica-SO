---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Configurar OpenRouter na UI do SO (Configurações > Integrações)

> **Fonte da verdade.** Origem: Lucas (2026-08-04). "Tenho uma chave do OpenRouter; onde configuro
> pra funcionar a parte de inspeção que subo o Excel? Preciso que isso esteja dentro da UI do SO —
> gere spec pra estar na parte de Configurações." Hoje a chave só existe como secret manual do
> Supabase (`OPENROUTER_API_KEY`), invisível/inconfigurável pelo SO.

## Contexto de código
- **UI de config já existe (E00-S12):** `features/config/pages/IntegracoesPage.tsx` +
  `application/integracoes.ts`/`integracoes-gateway.ts` + `infrastructure/supabase-integracoes-adapter.ts`.
  Guarda metadado em `config.integracoes` (RLS superadmin) e o segredo no **Supabase Vault** via
  `config.fn_definir_segredo_integracao` (**genérica por chave** — migration `0122` confirma que não
  precisa RPC nova por provedor) + `config.fn_integracao_tem_segredo` (checa existência, write-only,
  nunca reexibe).
- **Consumidores OpenRouter (Edge, Deno):** `_shared/openrouter.ts` (cliente compartilhado),
  `importar-relatorio-pdf` (import de inspeção XLS/questionário — E01-S96/S98), `pcm-ze-agent`.
  Todos leem `Deno.env.get("OPENROUTER_API_KEY")` (e `OPENROUTER_IMPORT_MODEL`, default
  `google/gemini-2.5-flash`).
- **Leitura de segredo no servidor:** padrão do projeto é `select ... from vault.decrypted_secrets
  where name = '<chave>'` dentro de função `security definer` (ver `0121`/`0122`/`0018`). Hoje não há
  RPC de **leitura** de segredo de integração — só escrita/checagem. Esta story adiciona a leitura.

## Resumo
OpenRouter vira uma **integração configurável** em Configurações > Integrações: o superadmin informa
a chave (guardada no Vault, write-only) e, opcionalmente, o modelo de import. O cliente compartilhado
`_shared/openrouter.ts` passa a **ler a chave do Vault** (via RPC `security definer`, service_role),
com fallback pro `Deno.env` atual (não quebra o que já roda). Assim, subir o Excel de inspeção
funciona com a chave configurada pela UI — sem tocar em secret do Supabase.

## Critérios de aceite

### AC-1: Configurar a chave OpenRouter pela UI
- **Dado** Configurações > Integrações (gate superadmin)
- **Quando** o superadmin informa a Chave do OpenRouter e salva
- **Então** a chave vai pro Vault (write-only, nunca reexibida — só "configurado"/atualizar), reusando
  `fn_definir_segredo_integracao`; um indicador mostra que OpenRouter está configurado.

### AC-2: Modelo de import opcional (metadado)
- **Dado** a mesma tela
- **Quando** o superadmin define (ou deixa em branco) o modelo de import
- **Então** o modelo é gravado como metadado não-sensível em `config.integracoes` (em branco =
  default `google/gemini-2.5-flash`).

### AC-3: Import de inspeção usa a chave configurada
- **Dado** a chave OpenRouter configurada pela UI
- **Quando** o operador sobe o Excel de inspeção (`importar-relatorio-pdf` via `_shared/openrouter.ts`)
- **Então** a chamada usa a chave do Vault e a classificação por IA roda — sem depender de secret
  manual em `Deno.env`.

### AC-4: Chave nunca exposta
- **Dado** a chave salva
- **Quando** qualquer tela/rota/log é inspecionada
- **Então** a chave nunca é reexibida na UI, nunca vai pro client, nunca aparece em log/erro (só a
  Edge com service_role a lê do Vault).

### AC-5: Falha clara quando não configurada
- **Dado** OpenRouter ainda não configurado (sem Vault, sem env)
- **Quando** o operador tenta subir o Excel
- **Então** o erro é claro ("OpenRouter não configurado — configure em Configurações > Integrações"),
  legível (pegada `edge-function-error`), não genérico.

## Casos de borda e erros
- Compat: enquanto o Vault não tiver a chave, cai no `Deno.env.OPENROUTER_API_KEY` (fallback) — a
  migração é sem downtime.
- Chave inválida/quota (OpenRouter 401/429): mensagem real propagada (já melhorado em E01-S96).
- Concorrência de consumidores (Zé + import ao mesmo tempo): leitura do Vault é idempotente/read-only.

## Fora de escopo
- Gerenciar múltiplas chaves/rotas por consumidor (uma chave OpenRouter pro SO).
- UI de billing/uso do OpenRouter.
- Migrar os secrets do Evolution/Auvo pra este mesmo fluxo (Evolution é E02-S27; cada um na sua story).

## Rastreabilidade
- Banco: reusa `config.fn_definir_segredo_integracao`/`fn_integracao_tem_segredo` (E00-S12); **nova**
  `config.fn_obter_segredo_integracao(chave)` `security definer`, restrita a service_role, retorna o
  valor do Vault pra Edge ler; chave canônica ex.: `openrouter_api_key`.
- Edge: `_shared/openrouter.ts` (lê Vault via RPC com fallback `Deno.env`), beneficia
  `importar-relatorio-pdf` e `pcm-ze-agent`.
- UI: `features/config/pages/IntegracoesPage.tsx` (+ provedor OpenRouter), `integracoes.ts`/adapter.
- Estende: E00-S12 (Configurações > Integrações + Vault). Mesmo padrão que E02-S27 (Evolution) segue.
- ADRs relacionados: — (se a leitura de segredo pela Edge via RPC virar padrão novo, registrar ADR).
