---
name: tasks-0002-abertura-chamado-ze
description: Decomposição e gates da abertura de chamado via Zé. Puxe ao implementar esta feature (Mês 2).
alwaysApply: false
---

# Tasks — Abertura de Chamado via Agente Zé

> Feature: tier arquitetural. Aguarda implementação — Mês 2.
> Rastreabilidade: cada task cita AC-N por extenso.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Criar schema `atendimento` + tabelas `wa_messages` e `wa_queue` com RLS FORCE e audit columns | — | — | `pnpm run audit:esteira` (migration válida) | todo |
| 2 | Implementar detecção determinística de menção (regex `\bz[eé]\b` + bot_id) — domain puro testável | AC-3, AC-4 | — | `pnpm --filter @sinergica/web test` | todo |
| 3 | Implementar Edge Function `pcm-whatsapp-webhook`: validar HMAC, persistir `wa_messages`, enfileirar `wa_queue` com delay 3s + `waitUntil` | AC-5, AC-6 | 1 | teste de integração (mock Evolution) | todo |
| 4 | Implementar Edge Function `pcm-ze-agent`: buscar fila, aplicar detecção de menção, chamar OpenRouter com tools (criar_chamado), persistir OS, responder via Evolution | AC-1, AC-2, AC-3, AC-4 | 2, 3 | teste de integração (mock OpenRouter + Evolution) | todo |
| 5 | Implementar cron de fallback `process_wa_queue` (Supabase cron, 1/min): reprocessar wa_queue com wait_until expirado | AC-6 | 3, 4 | teste de integração (DB local) | todo |
| 6 | Tipo `OrdemServicoInput` em `packages/shared` — contrato entre Atendimento e PCM | AC-1 | — | `pnpm --filter @sinergica/shared typecheck` | todo |

## Plano de teste
- **Unidade** (task 2): regex de detecção — cenários com/sem acento, @bot_id, off-topic.
- **Integração** (tasks 3, 4, 5):
  - Mock da Evolution API (webhook + send_text).
  - Mock do OpenRouter (tool-calling response).
  - Banco real (Supabase local via `supabase start`).
  - AC-1: fluxo completo — mensagem → OS criada → resposta enviada.
  - AC-2: coleta iterativa de dados faltantes.
  - AC-3/AC-4: menção força resposta; modo `monitor` com mensagem sem menção → SKIP.
  - AC-5: rajada de 3 mensagens → 1 OS criada.
  - AC-6: item expirado na fila → processado pelo cron.

## Divergências (SPEC_DEVIATION)
- Nenhuma ainda.

## Checklist de Definition of Done
- [ ] AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 verdes pelo gate de integração
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] HMAC de webhook validado com `constantTimeEqual` (`supabase/functions/_shared/crypto.ts`)
- [ ] Zod em toda borda de entrada (webhook body, tool params)
- [ ] `service_role` nunca exposto no frontend
- [ ] RLS FORCE no schema `atendimento`
- [ ] ADRs 0001 e 0002 registrados e referenciados
- [ ] `docs/STATE.md` atualizado ao concluir
