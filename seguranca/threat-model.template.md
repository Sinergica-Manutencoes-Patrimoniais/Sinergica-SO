---
name: threat-model
description: Template de threat model STRIDE para features que tocam auth/dado sensível/integração. Puxe no tier arquitetural ou quando @security exigir.
alwaysApply: false
---

# Threat Model (STRIDE) — <nome da feature>

> Faça quando a feature toca **autenticação/autorização, PII, dado financeiro, novo endpoint ou
> integração de terceiro**. Dono: `@security`. Não é para toda feature — só onde há superfície de
> ataque real (ver `ANTI-PADROES.md`). Features de **IA/LLM** usam também a trilha `ia/` (OWASP LLM).

## Ativos e superfície
- **O que protegemos:** <dados/operações sensíveis>.
- **Entradas/superfície:** <endpoints, webhooks, uploads, parâmetros, filas>.
- **Atores:** <usuário autenticado, anônimo, serviço externo, admin>.

## Análise STRIDE
| Categoria | Ameaça (pergunta) | Aplica? | Mitigação no Padrão OS |
|-----------|-------------------|---------|------------------------|
| **S**poofing (identidade) | Dá para se passar por outro? | | JWT validado (`auth.getUser`), nunca id do body |
| **T**ampering (integridade) | Dá para adulterar dado/requisição? | | Zod na borda; valores sensíveis vêm do banco; HMAC em webhook (`constantTimeEqual`) |
| **R**epudiation (rastro) | Dá para negar que fez? | | Log estruturado com `reqId`; `audit.*` append-only (OS) |
| **I**nformation disclosure | Vaza dado/segredo? | | RLS; erro sem stack (`problem+json`); sem PII em log; secret fora do client |
| **D**enial of service | Dá para derrubar/abusar? | | Rate limiting (fail-closed no sensível); paginação; idempotência |
| **E**levation of privilege | Dá para ganhar permissão indevida? | | RLS por papel (FORCE no OS); `service_role` só no servidor |

## Riscos priorizados e decisão
| Risco | Prob. × Impacto | Decisão (mitigar / aceitar) | Onde registra |
|-------|-----------------|-----------------------------|---------------|
| <…>   | médio × alto    | mitigar nesta feature       | task / código |
| <…>   | baixo × médio   | aceitar conscientemente     | `docs/SECURITY_DEBT.md` |

## Saída
- Mitigações viram **tasks** com gate. Dívida aceita → `docs/SECURITY_DEBT.md` (P0 bloqueia produção).
- Decisão estrutural de segurança → ADR.
