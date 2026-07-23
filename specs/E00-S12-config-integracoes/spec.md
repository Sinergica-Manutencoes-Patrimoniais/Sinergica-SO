---
name: spec-E00-S12-config-integracoes
description: Contrato — tela de Configurações > Integrações (segredos em Vault, começando por provedor de e-mail).
alwaysApply: true
tier: pequeno
---

# Spec — E00-S12: Configurações > Integrações

## Resumo
Nasce da necessidade do laudo PMOC (E01-S05) enviar e-mail: em vez de um secret cru via CLI, uma
tela de administração onde o superadmin configura credenciais de integrações externas (começando
por **provedor de e-mail**, extensível a outras no futuro). A credencial em si **nunca** fica numa
tabela Postgres legível — vai pro **Supabase Vault** (`vault.create_secret`/`update_secret`), mesmo
padrão já usado no repo pros secrets de cron Auvo (`db/README.md`, "Segurança — OS-grade": secrets em
Vault). A UI só guarda metadado não-sensível (provedor escolhido, e-mail remetente, se está ativo).

## Critérios de aceite

**AC-1 — Configurar credencial.** Given um usuário `superadmin`, When preenche a API key de um
provedor de e-mail (ex.: Resend) e salva, Then a chave é gravada no Vault via RPC
(`config.fn_definir_segredo_integracao`) — nunca trafega para uma tabela em texto plano, nunca
aparece de novo na tela depois de salva (write-only, mesmo padrão de "senha").

**AC-2 — Metadado não-sensível editável.** Given uma integração configurada, When o superadmin edita
provedor/e-mail remetente/ativo, Then esses campos persistem em `config.integracoes` (tabela normal,
sem segredo).

**AC-3 — Status sem vazar segredo.** Given uma integração, When a tela carrega, Then mostra "chave
configurada" / "chave não configurada" (via `config.fn_integracao_tem_segredo`, checa só existência)
— nunca mostra nem uma parte da chave.

**AC-4 — Acesso restrito a superadmin.** Given um usuário não-superadmin, When tenta ler ou escrever
`config.integracoes` ou chamar as RPCs de segredo, Then é negado (RLS + checagem interna nas
funções `security definer`, defesa em profundidade).

**AC-5 — Consumo pela Edge Function.** Given uma Edge Function que precisa da credencial (ex.:
`pmoc-generate-pdf` enviando e-mail), When executa, Then lê o segredo direto do Vault
(`vault.decrypted_secrets`, acesso `service_role`) — nunca via HTTP/API pública.

## Fora de escopo
- Múltiplos provedores simultâneos / fallback entre provedores — um provedor ativo por vez, por integração.
- Testar o envio real (botão "enviar teste") — pode vir depois; esta story é só o cadastro seguro da credencial.
- Outras integrações além de e-mail (WhatsApp/SMS/etc.) — schema já é genérico (`chave` extensível), mas só e-mail é usado agora.

## Rastreabilidade
- Migration: `supabase/migrations/0103_E00-S12_config_integracoes.sql`.
- Application: `apps/web/src/features/config/application/integracoes-gateway.ts` + `integracoes.ts`.
- Infra: `apps/web/src/features/config/infrastructure/supabase-integracoes-adapter.ts`.
- UI: `apps/web/src/features/config/pages/IntegracoesPage.tsx`, item novo em `CONFIG_NAV` (`HomePage.tsx`).
