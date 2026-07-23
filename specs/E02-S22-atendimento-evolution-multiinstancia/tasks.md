---
name: tasks
description: Tasks e gates do Atendimento Evolution multi-instância operacional.
alwaysApply: false
---

# Tasks — Atendimento Evolution multi-instância operacional

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|---|---|---|---|---|
| 1 | Criar migration de handoff, auditoria, CRM e rate limit | AC-4, AC-6, AC-7 | — | smoke SQL transacional remoto | done |
| 2 | Corrigir contrato/webhook Evolution | AC-1, AC-7, AC-8 | 1 | `deno test supabase/functions/_shared/*evolution*.test.ts` | done |
| 3 | Resolver persona e regras por instância | AC-2, AC-3, AC-4, AC-9 | 1 | `deno test supabase/functions/_shared/*atendimento*.test.ts` | done |
| 4 | Fechar handoff e resposta pontual autorizada | AC-4, AC-5 | 1,3 | `pnpm --dir apps/web test -- src/features/atendimento` | done |
| 5 | Implementar vínculo Cliente PCM no Inbox | AC-6 | 1 | `pnpm --dir apps/web test -- src/features/atendimento` | done |
| 6 | Rodar eval adversarial | AC-2, AC-3, AC-7, AC-8 | 2,3,4,5 | `node ia/evals/e02-s22-atendimento-evolution/run.mjs` | done |
| 7 | Aplicar migrations/functions no Supabase e executar smoke seguro | AC-1, AC-4, AC-6, AC-7 | 1-6 | `supabase migration list && supabase functions list` | done |
| 8 | Cadastrar/conectar duas instâncias e executar UAT A/B real | AC-1, AC-2, AC-3, AC-8 | 7 | UAT externo pós-merge + QR Codes | todo |

## Plano de teste
- Unidade: roteamento A/B, regras de handoff, payload Evolution, `fromMe`.
- Integração: pgTAP de RPC/RLS/auditoria e Edge Functions com mock HTTP.
- Aceite: duas instâncias de teste no mesmo servidor, cada uma com persona/base/regras distintas.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] Gates automatizados de todos os AC verdes; pgTAP, Deno, web e Playwright passaram
- [ ] UAT A/B externo com duas instâncias reais — requer conexão via QR Code
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] ADR registrado
- [x] Glossário previsto para atualização
- [x] Spec reflete o construído
- [x] `docs/STATE.md` atualizado
