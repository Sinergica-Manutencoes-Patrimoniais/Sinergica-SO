---
name: E02-S32-mensagens-celular-atendimento
description: Exibir mensagens de WhatsApp enviadas via celular (não só via app) no Atendimento
alwaysApply: true
---

# E02-S32 — Mensagens do celular no Atendimento

> **SPEC_DEVIATION (2026-08-15):** as tasks abaixo citam `atendimento.chamados_interacoes` e
> `supabase-historico-chamado-adapter.ts` — não existem. A tabela real do chat é
> `atendimento.mensagens`, webhook real é `pcm-whatsapp-webhook/index.ts`. Ver `tasks.md` pros
> nomes corretos; ACs abaixo continuam válidos como estão.

## Contexto
Supervisor/técnico envia WhatsApp pelo celular pessoal usando a conta Sinérgica.
Mensagens **não aparecem** no Inbox do Atendimento (app SO) — só aparecem se enviadas via "Responder com IA" ou manualmente pelo formulário.

## Requisitos

### AC-1: Sincronizar mensagens de saída
- Evolution/WhatsApp webhook (já conectado, E02-S09) recebe **enviada pelo celular**
- Salvar em `atendimento.chamados_interacoes` (tipo: `enviada`, origem: `celular`, não `ia`/`formulario`)

### AC-2: Exibir no Inbox
- Bolha da conversa mostra mensagem com marca "📱 Enviado pelo celular" (distintivo visual)
- Não aparece no resumo "X respostas não lidas" se enviada pelo celular (só mensagens de **entrada** contam)

### AC-3: Ordem cronológica
- Mensagens de celular/app/IA respeitam timestamp real do webhook, não hora da leitura
- Timeline segue ordem real de eventos

### AC-4: Sem duplicação
- Se a mesma mensagem chegar 2x (rede instável), `idempotência` previne inserção duplicada

## Fora de escopo
- Envio direto do app (AC-1 é só captura, não novo botão de envio)
- Confirmação de entrega (Zap/lido) — captura simples

## Tier
Pequeno (coluna nova + lógica webhook + UI distintivo).

---

## Tarefas

1. **Migration `0207`:** `atendimento.chamados_interacoes` ganha `origem_envio` (enum: 'formulario', 'ia', 'celular')
2. **Evolution webhook:** discriminar mensagens de entrada vs saída (`eventType`, `status`) — documentar payload real
3. **Adapter:** `supabase-historico-chamado-adapter.ts` salva com `origem_envio='celular'` se detectada
4. **UI:** `HistoricoChamadoInteracao` mostra ícone 📱 quando `origem_envio='celular'`
5. **Testes:** unit (parser webhook) + Playwright (visual distintivo)

---

## Validação
- `ci:local` verde
- Smoke: webhook simula mensagem de celular, aparece no Inbox com marca
- Playwright: lista conversa, bolha distintiva visível
