---
name: tasks
description: Decomposição e gates de E02-S35. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S35 · Canal Evolution confiável

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | ADR `1686-evolution-configurada-pela-ui.md` | — | — | revisão humana | todo |
| 2  | `domain/evolution-compatibilidade.ts` + matriz inicial | AC-2 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/evolution-compatibilidade.test.ts` | todo |
| 3  | `domain/canal-evolution.ts` (estados, saúde, transições) | AC-6, AC-7, AC-8 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/canal-evolution.test.ts` | todo |
| 4  | `_shared/evolution-url.ts` anti-SSRF `[P]` | AC-1 | 1 | `deno test supabase/functions/_shared/evolution-url.test.ts` | todo |
| 5  | `_shared/evolution-matriz.ts` (espelho) + teste de paridade com a task 2 | AC-2 | 2 | `deno test supabase/functions/_shared/evolution-matriz.test.ts` | todo |
| 6  | Migration `1829` — provedor, estado, saúde + backfill + trigger de compat | AC-10 | 1 | `pnpm run db:test -- canal_evolution_estado` | todo |
| 7  | Migration `1830` — `evolution_servidor`, `evolution_instancia`, RLS force + policies | AC-9 | 6 | `pnpm run db:test -- evolution_rls` (pgTAP: superadmin permitido, colaborador negado) | todo |
| 8  | Migration `1831` — cofre por referência opaca (`fn_gravar/ler/remover_segredo_referenciado`) | AC-3 | 1 | `pnpm run db:test -- cofre_referencia` (anon/authenticated negados, formato recusado) | todo |
| 9  | `atendimento-evolution`: ação `salvar_servidor` (probe + SSRF + matriz + cofre) | AC-1, AC-2, AC-3 | 4, 5, 7, 8 | `deno test supabase/functions/atendimento-evolution/salvar-servidor.test.ts` | todo |
| 10 | `atendimento-evolution`: ação `criar_instancia` idempotente, nome derivado | AC-4 | 9 | `deno test supabase/functions/atendimento-evolution/criar-instancia.test.ts` | todo |
| 11 | `atendimento-evolution`: ação `instalar_webhook` + estado `configuracao_incompleta` na falha | AC-5 | 10 | `deno test supabase/functions/atendimento-evolution/instalar-webhook.test.ts` | todo |
| 12 | `application/configurar-evolution.ts` (sequência atômica) + `verificar-canal.ts` | AC-5, AC-7 | 3 | `pnpm vitest run apps/web/src/features/atendimento/application/configurar-evolution.test.ts` | todo |
| 13 | Adapter `supabase-evolution-adapter.ts`: novas ações, sem segredo na resposta | AC-3 | 11, 12 | `pnpm vitest run apps/web/src/features/atendimento/infrastructure/supabase-evolution-adapter.test.ts` | todo |
| 14 | `components/ConfiguracaoEvolution.tsx` (máquina de vistas + textos de erro) | AC-1, AC-2, AC-5, AC-8 | 13 | `pnpm vitest run apps/web/src/features/atendimento/components/ConfiguracaoEvolution.test.tsx` | todo |
| 15 | `EvolutionTab.tsx` consome a nova máquina, mantendo a lista atual `[P]` | AC-8 | 14 | `pnpm vitest run apps/web/src/features/atendimento/components/EvolutionTab.test.tsx` | todo |
| 16 | Registrar débito em `docs/SECURITY_DEBT.md` (token global do webhook; exclusão a pedido) | — | 1 | revisão humana | todo |
| 17 | Glossário: canal, provedor, instância, servidor Evolution, saúde do canal | — | 1 | `grep` dos termos em `docs/glossary.md` | todo |
| 18 | `/revisao-adversarial` (tier arquitetural) | todos | 15 | achado reproduzido vira teste | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste

- **Unidade:** `avaliarCompatibilidade` (versão ausente, capacidade faltando, caminho feliz);
  transições de estado e saúde; `precisaReescanear`; sanitização da resposta (nenhum segredo).
- **Integração:** anti-SSRF com fakes de DNS (loopback, link-local, metadata, privado, público,
  redirect que muda origem); `criar_instancia` chamado duas vezes gera uma instância;
  `instalar_webhook` falhando deixa `configuracao_incompleta`.
- **DB (pgTAP, `db-tests` não pulado):** RLS permitido (superadmin) e negado (colaborador) nas duas
  tabelas novas; cofre negado para `anon`/`authenticated`; formato de referência recusado; backfill de
  provedor sem palpite; trigger de sincronia nas 6 transições.
- **Aceite:** um teste por AC-1..AC-10.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`gh pr checks`, incluindo `db-tests` **não pulado**)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR `1686` registrado antes da implementação
- [ ] `/revisao-adversarial` rodada, achados viraram teste
- [ ] Glossário atualizado
- [ ] Débito registrado em `docs/SECURITY_DEBT.md`
- [ ] `docs/STATE.md` atualizado via `/handoff`
