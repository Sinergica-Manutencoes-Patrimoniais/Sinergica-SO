---
name: tasks-E04-S08-regua-cobranca-inadimplencia
description: Decomposição — régua de cobrança ativa.
alwaysApply: false
---

# Tasks — Régua de cobrança

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: config da régua + log de envios (RLS)            | AC-1,3   | E04-S04    | `pnpm lint:migrations`+pgTAP | done   |
| 2  | Domínio: avaliar recebível × pontos da régua (idempotente)  | AC-2,3,4 | —          | `pnpm test`                  | done   |
| 3  | Edge Function de disparo (WhatsApp/e-mail, degrada s/ canal) | AC-2,5  | 1,2        | teste Deno                   | done   |
| 4  | pg_cron diário chamando o disparo                          | AC-2     | 3          | migration                    | done   |
| 5  | UI Config → Cobrança (pontos/canal/modelo)                 | AC-1     | 1          | browser                      | done   |

## Plano de teste
- Unidade: não reenviar mesmo ponto; parar ao pagar; sem canal não finge.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [x] AC-1..AC-5 verdes
- [x] `pnpm run ci:local` verde; Edge Function deployada + smoke
- [x] `docs/STATE.md` + ROADMAP atualizados
