---
name: blueprint-integracao-whatsapp-evolution
description: Blueprint da integração WhatsApp via Evolution API. Puxe ao planejar specs do Agente Zé ou envio de relatórios.
alwaysApply: false
---

# Blueprint — WhatsApp / Evolution API

## Arquitetura
```
Mensagem WhatsApp
  → Evolution API (Cloudfy, auto-hospedado)
      → Webhook POST para Supabase Edge Function `pcm-whatsapp-webhook`
          → Persiste em `atendimento.wa_messages`
          → Enfileira em `atendimento.wa_queue` (delay 3s, agrupa rajadas)
          → `waitUntil` dispara `pcm-ze-agent`
              → LLM + tool-calling → resposta
  ← `send_message` via Evolution API REST
```

## Webhooks recebidos
| Evento | Quando | O que fazer |
|--------|--------|-------------|
| `messages.upsert` | Nova mensagem recebida | Persistir + enfileirar |
| `messages.update` | Status de entrega | Atualizar status (read, delivered) |
| `connection.update` | Instância conectou/desconectou | Alertar admin se desconectar |

## Envio de mensagens
- Endpoint: `POST /message/sendText/{instance}`.
- Payload: `{ number, text, delay? }`.
- Grupos: `number = group_jid@g.us`.
- DMs: `number = 55<ddd><numero>@s.whatsapp.net`.

## Segurança
- Webhook HMAC: `X-Evolution-Signature` validada com `constantTimeEqual` (ver `supabase/functions/_shared/crypto.ts`).
- CORS restrito ao domínio Supabase.
- Nenhuma credencial da Evolution no frontend.

## Configuração por condomínio
- `whatsapp_group_jid`: ID do grupo vinculado ao cliente (obtido ao adicionar bot ao grupo).
- `ze_active`, `ze_mode`, `ze_model`, `ze_prompt_custom`: configuráveis pelo admin.

## Latência alvo
- P95 < 10s do recebimento da mensagem à resposta do Zé.
- Fallback: cron a cada 1 min processa `wa_queue` não processada.
