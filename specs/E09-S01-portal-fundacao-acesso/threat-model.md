---
name: threat-model-E09-portal-cliente
description: STRIDE — Portal do Cliente, tenancy por claim, uploads, aceite e dados financeiros.
alwaysApply: false
---

# Threat Model (STRIDE) — Portal do Cliente E09

## Ativos e superfície
- **Protegemos:** dados operacionais, documentos privados, faturas e decisões comerciais de cada condomínio; credenciais do síndico.
- **Entradas:** login local, provisionamento administrativo, consultas PostgREST, uploads privados, decisão de orçamento e pesquisa de satisfação.
- **Atores:** `cliente-sindico`, usuários internos, `service_role`, Supabase Auth e integrações de e-mail/cobrança.

## Análise STRIDE
| Categoria | Ameaça | Mitigação implementada |
|-----------|---------|------------------------|
| Spoofing | Síndico falsifica `cliente_id` | Claim assinado nasce no Auth Hook a partir de `config.usuario_cliente`; banco nunca aceita `cliente_id` do frontend como autoridade. |
| Tampering | Cliente altera status, valor, vínculo ou nota antiga | RLS FORCE; escritas do portal têm `WITH CHECK`; notas/decisões sem policy UPDATE/DELETE; orçamento decidido por RPC transacional. |
| Repudiation | Cliente nega aceite/recusa | `pcm.orcamento_decisoes` append-only com `autor_user_id` e timestamp. |
| Information disclosure | IDOR entre condomínios ou exposição de custo/margem | Policies por `cliente_id`; pgTAP A/B; views financeiras dedicadas sem colunas internas; buckets privados e signed URL. |
| Denial of service | Upload grande ou consultas sem limite | Buckets limitados a 10 MB e MIME allowlist; OS limitada a 100; rate limiting global segue `SEC-003`. |
| Elevation of privilege | Cliente alcança HomePage ou APIs internas | `PortalShell` por papel, build separado com gate anti-import e RLS como controle primário; `service_role` só em Edge Function. |

## Riscos e decisão
| Risco | Prob. × Impacto | Decisão | Onde |
|-------|-----------------|---------|------|
| Policy futura esquece `cliente_id` | médio × alto | mitigar | checklist + `portal_cliente_isolamento.test.sql` |
| Token mantém vínculo antigo até refresh | baixo × médio | aceitar | ADR-0011 |
| Abuso volumétrico de Edge Functions | médio × médio | aceitar temporariamente | `docs/SECURITY_DEBT.md` SEC-003 |
| Bundle separado sem CSP/anti-frame | baixo × alto | mitigar | `apps/portal/netlify.toml` |

