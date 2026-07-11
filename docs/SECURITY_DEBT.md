---
name: SECURITY_DEBT
description: Registro de dívida de segurança aceita conscientemente. Puxe em revisão de segurança ou antes de deploy.
alwaysApply: false
---

# SECURITY_DEBT — Dívida de segurança conhecida

> Toda exceção ao baseline de segurança aceita conscientemente mora aqui — nunca em silêncio.
> Prioridade: **P0** (corrigir antes de produção) · **P1** (próximo ciclo) · **P2** (quando der).
> Ver `seguranca/os-grade.md` (baseline OS obrigatório neste projeto).

## Dívidas herdadas do PCM v2 (evitar na recriação)
> Estas são as issues do sistema legado — servem como LISTA NEGRA ao construir o Sinérgica SO.
> Não são dívidas do repositório atual, mas guias do que garantir por design.

| ID | Origem (PCM v2) | O que evitar no Sinérgica SO |
|----|-----------------|------------------------------|
| LEGADO-001 | IDOR em `atualizar_chamado` — sem filtro por `client_id` | RLS FORCE com policy `WHERE client_id = auth.uid()` ou workspace isolado |
| LEGADO-002 | 63 tabelas sem `FORCE RLS` | `ALTER TABLE ... FORCE ROW LEVEL SECURITY` em toda tabela na migration |
| LEGADO-003 | CORS `*` nas Edge Functions | CORS restrito a `VITE_SUPABASE_URL` + domínio Netlify em produção |
| LEGADO-004 | Sem validação Zod na borda | Toda Edge Function e handler: Zod antes de acessar o banco |
| LEGADO-005 | Sem verificação de JWT em funções | `await supabase.auth.getUser()` em toda função que toca dados do usuário |
| LEGADO-006 | Buckets de storage públicos | Buckets privados + signed URLs com expiração |
| LEGADO-007 | Login via GET (credenciais em logs) | Login via POST; nunca credenciais em query string ou URL |
| LEGADO-008 | Webhook Auvo sem validação de assinatura HMAC | `crypto.ts` (_shared) com `constantTimeEqual` para validar HMAC |

## Dívidas do Sinérgica SO (atuais)
| ID | Descrição | Risco / impacto | Prio | Plano de correção | Status |
|----|-----------|-----------------|------|-------------------|--------|
| SEC-001 | ~~Projeto Supabase ainda não provisionado~~ — desatualizado: projeto está em produção desde E00-S05 (hook JWT + schemas expostos confirmados via Management API), 83 migrations aplicadas, todas com `FORCE ROW LEVEL SECURITY` por convenção do `lint:migrations`/Squawk. RLS FORCE não foi reconfirmada por query direta ao Postgres de produção nesta sessão (sem acesso ao dashboard) | acesso indevido se a convenção falhar numa migration | P1 | rodar `select relname from pg_class where relforcerowsecurity = false and relnamespace in (select oid from pg_namespace where nspname in ('pcm','atendimento','comercial','relacionamento','config'))` contra prod e confirmar 0 linhas | reavaliar (era P0/"aberto" por premissa desatualizada) |
| SEC-002 | Security headers (CSP, X-Frame-Options, HSTS) não configurados | clickjacking/XSS | P1 | configurar `netlify.toml` (headers) no Mês 2 | aberto |
| SEC-003 | Rate limiting não implementado nas Edge Functions públicas | abuso/DoS | P2 | usar `_shared/cors.ts` pattern com rate-limit header | aberto |

<!-- Adicione novas linhas com IDs sequenciais. Feche movendo status para "fechado" com data. -->
