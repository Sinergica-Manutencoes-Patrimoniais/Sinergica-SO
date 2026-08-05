---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Configurar Evolution no SO (URL + chave) e expor o endereço de webhook

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 9, com print). O escopo real **não** é um
> erro na API — é que **não existe no SO** onde configurar a conexão Evolution nem ver o webhook.
> Fala do Lucas: "preciso configurar a API e a chave e não tem essa opção; preciso do endereço de
> webhook para configurar também; não tem nada disso aqui no SO." Doc:
> https://docs.evolutionfoundation.com.br/evolution-api

## Contexto de código — causa raiz
- Hoje a conexão Evolution vive **só em secrets do Supabase** (`Deno.env`), sem UI:
  `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` (lidos em `atendimento-evolution/index.ts` L280-281),
  `EVOLUTION_WEBHOOK_TOKEN`/`EVOLUTION_HMAC_SECRET` (auth do webhook), `EVOLUTION_INTEGRATION`
  (default `WHATSAPP-BAILEYS`). O usuário do SO **não tem tela** pra definir URL/chave.
- O print ("URL de Conexão" / "Chave do Evolution") é do **painel do provedor Evolution
  (cloudfy.live)** — essas strings **não existem no código do SO** (confirmado por grep). O usuário
  precisa levar esses dados **para dentro do SO**.
- O webhook do SO é **hardcoded** em `_shared/evolution-admin.ts` L17:
  `${SUPABASE_URL}/functions/v1/pcm-whatsapp-webhook`. É registrado automaticamente por instância
  (botão "Registrar webhook", `sincronizar_webhook`), mas **nunca é exibido** — o usuário não
  consegue ver/copiar o endereço pra conferir ou configurar no Evolution.
- Padrão de segredo configurável já existe no projeto: E00-S12 (`config.integracoes` + Supabase
  Vault via `fn_definir_segredo_integracao`, chave write-only nunca reexibida, gate superadmin).

## Resumo
Dar ao SO uma tela pra **configurar a conexão Evolution** (URL de Conexão + Chave, a chave como
segredo em Vault, write-only) e **exibir o endereço de webhook** do SO (copiável) pra colar/conferir
no Evolution. As Edge Functions passam a usar essa config. Com isso, cadastrar instância e conectar
funciona ponta a ponta.

## Critérios de aceite

### AC-1: Configurar URL + chave do Evolution no SO
- **Dado** a tela de configuração do Atendimento/Evolution (gate de escrita/superadmin)
- **Quando** o operador informa a URL de Conexão e a Chave do Evolution e salva
- **Então** a URL é gravada (metadado) e a Chave vai pro Vault (write-only, nunca reexibida — padrão
  E00-S12); um indicador mostra "configurado".

### AC-2: Endereço de webhook exposto e copiável
- **Dado** a mesma tela
- **Quando** o operador olha a seção de webhook
- **Então** vê o endereço de webhook do SO (`<SUPABASE_URL>/functions/v1/pcm-whatsapp-webhook`) com
  botão copiar, pronto pra configurar/conferir no Evolution.

### AC-3: Edge Functions usam a config salva
- **Dado** URL/chave configuradas no SO
- **Quando** o operador cria/conecta uma instância
- **Então** a Edge Function `atendimento-evolution` usa a config salva (Vault/config), não depende de
  secret manual em `Deno.env`, e o cadastro conclui (instância criada, QR exibido).

### AC-4: Erro real legível
- **Dado** que a Evolution recusa (URL/chave inválida, indisponível)
- **Quando** o cadastro/conexão falha
- **Então** a UI mostra o motivo real (status + mensagem da Evolution), não erro genérico (pegada
  `edge-function-error`); URL/chave ausentes → mensagem clara do que falta configurar.

## Casos de borda e erros
- Chave nunca no client nem em tabela comum — só Vault; nunca reexibida após salvar (só "configurado"/atualizar).
- URL sem esquema/porta errada: validar/normalizar (a Edge já faz `replace(/\/+$/,"")`), mensagem clara.
- Sem config salva: manter compat com `Deno.env` como fallback (não quebrar o que já roda), mas a UI
  orienta configurar.
- Webhook token (`EVOLUTION_WEBHOOK_TOKEN`) continua secret server-side; o que se exibe é só a **URL**
  do webhook, não o token.

## Fora de escopo
- Redesenhar o fluxo multi-instância/QR (E02-S22) — aqui é config + webhook + fazer o cadastro rodar.
- Configurar o webhook automaticamente no Evolution além do que o botão "Registrar webhook" já faz
  (mas exibir a URL é escopo).

## Rastreabilidade
- Código: `pages/AtendimentoConfigPage.tsx` (+ tab de config Evolution), `components/EvolutionTab.tsx`,
  `application/evolution.ts`/`config-gateway.ts`, `infrastructure/supabase-evolution-adapter.ts`,
  `supabase/functions/atendimento-evolution/index.ts` (ler config), `_shared/evolution-admin.ts`
  (URL do webhook), padrão Vault de E00-S12 (`config.integracoes`/`fn_definir_segredo_integracao`),
  `lib/http/edge-function-error.ts`.
- Estende: E02-S19 (config Evolution), E02-S22 (multi-instância), E00-S12 (segredos em Vault).
- ADRs relacionados: — (reusa padrão E00-S12; se a leitura de secret pela Edge via Vault virar
  decisão nova, registrar ADR).
