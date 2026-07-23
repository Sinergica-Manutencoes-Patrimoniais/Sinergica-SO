---
name: tasks-E04-S09-cobranca-boleto-pix
description: Decomposição — cobrança boleto/PIX via gateway.
alwaysApply: false
---

# Tasks — Cobrança boleto/PIX

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | ~~Definir provedor~~ — **Mercado Pago** (Lucas, 2026-07-21)   | —        | —          | decisão                      | done   |
| 2  | Migration `financeiro.cobrancas` + `config.integracoes` provedor | AC-1,2 | E04-S04    | `pnpm lint:migrations`+pgTAP | done   |
| 3  | Porta `CobrancaGateway` + adapter Mercado Pago              | AC-2     | 1          | teste Deno/unit              | done   |
| 4  | Edge Function emitir cobrança (Vault)                       | AC-1,2   | 2,3        | teste Deno + smoke           | done   |
| 5  | Edge Function webhook baixa (HMAC antes do parse, idempotente) | AC-3,5 | 2          | teste Deno                   | done   |
| 6  | Poll de reconciliação (dedupe por evento)                  | AC-4     | 3          | teste Deno                   | done   |
| 7  | UI: emitir boleto/PIX no recebível + exibir link/QR         | AC-2     | 4          | browser                      | done   |

## Plano de teste
- Unidade: idempotência do webhook; estados pago/parcial/estorno/cancelado.
- Integração: HMAC inválido rejeitado antes do parse; emissão em sandbox.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- Nenhuma pendente. Provedor definido (Mercado Pago, 2026-07-21).

## Checklist de Definition of Done
- [x] AC-1..AC-5 verdes
- [x] `pnpm run ci:local` verde; Edge Functions deployadas + smoke; webhook HMAC testado
- [x] Credencial só no Vault, nada sensível em log
- [x] `docs/STATE.md` + ROADMAP atualizados
