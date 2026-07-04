---
name: tasks-0002-abertura-chamado-ze
description: Decomposição e gates da abertura de chamado via Zé. Puxe ao implementar esta feature (Mês 2).
alwaysApply: false
---

# Tasks — Abertura de Chamado via Agente Zé

> Feature: tier arquitetural. Implementação local parcial por Codex em 2026-07-04 (Fluxo A direto
> WhatsApp → OS, sem orçamento).
> Rastreabilidade: cada task cita AC-N por extenso.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Criar schema `atendimento` + tabelas `wa_messages` e `wa_queue` com RLS FORCE e audit columns | — | — | `pnpm run audit:esteira` (migration válida) | done (já existia desde `0001`; E01-S02 adicionou grants operacionais em `0018`) |
| 2 | Implementar detecção determinística de menção (regex Unicode para `z[eé]` + bot_id) — domain puro testável | AC-3, AC-4 | `pnpm test` | done (5 testes verdes) |
| 3 | Implementar Edge Function `pcm-whatsapp-webhook`: validar HMAC, persistir `wa_messages`, enfileirar `wa_queue` com delay 3s + `waitUntil` | AC-5, AC-6 | teste de integração (mock Evolution) | done (código; integração real não executada) |
| 4 | Implementar Edge Function `pcm-ze-agent`: buscar fila, aplicar detecção de menção, chamar OpenRouter em JSON mode, persistir OS, responder via Evolution | AC-1, AC-2, AC-3, AC-4 | teste de integração (mock OpenRouter + Evolution) | done (código; integração real não executada) |
| 5 | Implementar cron de fallback `process_wa_queue` (Supabase cron, 1/min): reprocessar wa_queue com wait_until expirado | AC-6 | teste de integração (DB local) | done (`0018`; exige secrets Vault `ze_agent_project_url`/`ze_agent_service_role_key`) |
| 6 | Tipo `OrdemServicoInput` em `packages/shared` — contrato entre Atendimento e PCM | AC-1 | `pnpm run typecheck` | done |

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
- **SPEC_DEVIATION #1 — sem teste de integração real/mocks para Edge Functions.** Código das Edge
  Functions foi escrito, mas não há Deno CLI/mock Evolution/OpenRouter/Supabase local neste ambiente.
  AC-1/AC-2/AC-5/AC-6 dependem de validação real antes de produção.
- **SPEC_DEVIATION #2 — `ze_active` não existe no schema atual.** A spec cita "Condomínio sem
  `ze_active = true`"; o schema existente usa `atendimento.config_ze.modo` (`off|monitor|active`).
  A implementação trata ausência de config como SKIP e `modo='off'` como SKIP.
- **Risco conhecido — geração de `numero` CH-XXX.** MVP usa contagem atual + 1; o lock de fila evita
  duplicidade por rajada, mas concorrência entre origens diferentes ainda pode colidir no unique de
  `pcm.ordens_servico.numero`. Se isso aparecer em produção, mover para sequence/RPC transacional.

## Resultado da implementação local
- `packages/shared/src/index.ts`: `OrdemServicoInput` e enums compartilhados.
- `apps/web/src/features/atendimento/domain/deteccao-mencao-ze.ts` + teste unitário.
- `supabase/migrations/0018_E01-S02_ze_fluxo_a_operacional.sql`: grants de `service_role`, função
  fallback e cron minutely para `pcm-ze-agent`.
- `supabase/functions/pcm-whatsapp-webhook/index.ts`: HMAC Evolution, persistência da mensagem,
  agrupamento de rajada em `wa_queue`, `waitUntil` para agent.
- `supabase/functions/pcm-ze-agent/index.ts`: lock de fila, modo/menção, OpenRouter JSON, criação
  de OS `origem='ze'`, resposta Evolution.

## Gates rodados
- `pnpm run lint:migrations` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm test` ✅ (98 passed, 9 skipped)
- `pnpm run build` ✅ (warning conhecido de chunk >500k)

## Checklist de Definition of Done
- [ ] AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 verdes pelo gate de integração
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [x] HMAC de webhook validado com `constantTimeEqual` (`supabase/functions/_shared/crypto.ts`)
- [x] Zod em toda borda de entrada (webhook body, agent input)
- [x] `service_role` nunca exposto no frontend
- [x] RLS FORCE no schema `atendimento` (já vinha de `0001`)
- [x] ADRs 0001 e 0002 registrados e referenciados
- [x] `docs/STATE.md` atualizado ao concluir
