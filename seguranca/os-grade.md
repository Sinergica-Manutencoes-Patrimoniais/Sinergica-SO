---
name: seguranca-os-grade
description: Segurança OS-grade (multi-domínio, PII, financeiro, integrações). Soma-se ao baseline mínimo. Puxe em sistema OS.
alwaysApply: false
---

# Segurança — OS-grade (sistemas multi-domínio)

> **Soma-se** ao `base/seguranca/baseline-minimo.md` (não o substitui). Aplique quando o sistema
> é OS (multi-domínio) ou toca PII (CPF, email), dados financeiros, ou integrações de terceiros.
> Gate: `@security`/`@qa` revisam antes do merge nessas situações.

## Banco
- [ ] **RLS FORCE** em toda tabela (`force row level security`) — nem o owner escapa das policies.
- [ ] **Schemas por domínio** (`crm`, `financeiro`, …) — isolamento lógico e RLS por contexto.
- [ ] **`audit.*` append-only**: policies negam UPDATE/DELETE para todos, inclusive `service_role`.
- [ ] Colunas de auditoria em toda tabela: `created_by`, `updated_by`, `deleted_at`.
- [ ] Índice composto `(workspace_id, created_at)` em tabelas com volume (evita timeout).
- [ ] Idempotência (`request_id unique`) em operações financeiras.

## Edge Functions (Deno)
- [ ] Padrão: CORS → `requireAuth` (JWT) → rate-limit → validar Zod → lógica → resposta sem stack.
- [ ] `service_role` só no servidor; nunca exposto ao frontend.
- [ ] **Webhooks de terceiro**: validar assinatura HMAC com `constantTimeEqual` (ver `base/supabase/functions/_shared/crypto.ts`).
- [ ] Rate limiting em funções públicas (`fail-closed` no caminho sensível).

## Credenciais externas (OAuth / API keys)
| Tipo               | Armazenamento                  | Acesso                  | Rotação           |
|--------------------|--------------------------------|-------------------------|-------------------|
| API key estática   | `config`/integration_configs (RLS) | Edge Functions       | manual            |
| OAuth access_token | integration_configs (cifrado)  | Edge Functions          | automática (cron) |
| OAuth refresh_token| **Supabase Vault**             | `Deno.env` (nunca na UI)| automática        |

Fallback ao expirar: tentar refresh → se falhar, retornar 503 + alerta (Teams) — nunca silenciar.

## LGPD
- [ ] Schema `lgpd.*` para consentimentos, export e delete; trilha em `audit.*`.
- [ ] Dado pessoal minimizado e com base legal; export/delete sob demanda.

## Headers de produção
- [ ] CSP, `X-Frame-Options`, HSTS configurados no deploy. CORS fixo no domínio.

> Toda exceção aceita conscientemente → `docs/SECURITY_DEBT.md` (P0 bloqueia produção).
