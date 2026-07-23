---
name: threat-model
description: STRIDE do runtime Evolution multi-instância e vínculo CRM.
alwaysApply: false
---

# Threat Model (STRIDE) — Atendimento Evolution multi-instância

## Ativos e superfície
- Protegemos mensagens, identidade do contato, vínculo com Cliente PCM, prompts/conhecimento e segredos.
- Superfície: webhook público, Edge Functions autenticadas, fila, RPC de vínculo e Evolution REST.
- Atores: Evolution, contato WhatsApp, atendente autenticado, agente e atacante anônimo.

## Análise STRIDE
| Categoria | Ameaça | Aplica? | Mitigação |
|---|---|---|---|
| Spoofing | webhook forjado | sim | HMAC ou token secreto, comparação constante e fail-closed |
| Tampering | trocar `instance_id`/cliente | sim | Zod, resolução no banco e RPC transacional |
| Repudiation | negar handoff/vínculo | sim | eventos append-only com ator/data |
| Information disclosure | cruzar persona/cliente | sim | roteamento exato, RLS FORCE, segredo só Edge |
| Denial of service | rajada/replay | sim | rate limit, debounce e `message_id` único |
| Elevation of privilege | browser chamar service role | sim | wrapper autenticado e chamada interna server-side |

## Riscos priorizados e decisão
| Risco | Prob. × Impacto | Decisão | Onde registra |
|---|---|---|---|
| eco `fromMe` cria loop | alto × alto | mitigar | webhook + teste |
| contrato Evolution diverge | alto × alto | mitigar | adapter + contract test |
| rate limit distribuído ausente | médio × alto | mitigar | RPC atômica |
| prompt injection | médio × alto | mitigar | delimitadores, schema de saída e eval |

## Saída
Nenhuma dívida P0 aceita. SEC-003 deixa de valer para este webhook após rate limit server-side.
