---
name: tasks
description: Decomposição e gates — contrato comercial gerado da proposta aceita, criando o plano de faturamento no Financeiro.
alwaysApply: false
---

# Tasks — E03-S07 · Contratos

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S07-contratos`. **Depende de S04 e S06 mergeadas.**
> **Tier arquitetural** — cruza Comercial → Financeiro e Comercial → PCM. Reler ADR-0019 (R1/R2)
> antes de escrever qualquer escrita cross-schema.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Task obrigatória antes de codar**: confirmar em produção o estado de `financeiro.contratos` (quantas linhas legadas, colunas obrigatórias) e como `fn_gerar_recorrencias` (E04-S04) as consome — o AC-4 e o AC-6 dependem de não quebrar o cron que já roda | AC-4, AC-6 | — | `supabase db query --linked` (read-only) | todo |
| 2 | Migration `NNNN_E03-S07_contratos_comercial.sql`: `comercial.contratos` (`unique` em `proposta_id` — AC-3), RLS FORCE + policies por `user_modulos.comercial` | AC-1, AC-3 | — | `pnpm run lint:migrations` | todo |
| 3 | Migration `NNNN_E03-S07_fk_financeiro.sql`: coluna `financeiro.contratos.comercial_contrato_id` **nullable** (legado fica nulo — AC-6) + FK `not valid`, `validate` em migration separada (padrão 0139/0140) | AC-4, AC-6 | 2 | `pnpm run lint:migrations` | todo |
| 4 | Migration `NNNN_E03-S07_rpc_ativar.sql`: RPC `financeiro.fn_criar_plano_faturamento(...)` `security definer` com guarda de permissão (publicada **pelo Financeiro**, R2) e RPC `comercial.fn_ativar_contrato(...)` que faz tudo numa **transação atômica**: valida vigência, cria o plano, move a oportunidade para `ganha`, marca o contrato ativo | AC-4, AC-5, AC-7 | 3 | `pnpm run lint:migrations` | todo |
| 5 | `domain/contrato.ts`: transições de status (`rascunho → ativo → suspenso/encerrado`), validação de vigência, `reajusteDevido(contrato, hoje)` (AC-9) — puras + unit tests | AC-8, AC-9 | — | `pnpm run test` | todo |
| 6 | Casos de uso + adapter: gerar contrato a partir da proposta aceita (pré-preenchendo da proposta), ativar (chama a RPC atômica), encerrar com data e motivo | AC-2, AC-4, AC-8 | 4, 5 | `pnpm run test` | todo |
| 7 | `ContratosPage`: lista com status/vigência/valor, criação a partir da proposta, edição antes de ativar, ativar, encerrar; aviso quando o cliente já tem contrato ativo | AC-2, AC-8 | 6 | `pnpm run test` | todo |
| 8 | Sinalização de reajuste devido (badge/lista) — **sem aplicar automaticamente**; aplicar é ação humana que grava registro | AC-9 | 5, 7 | `pnpm run test` | todo |
| 9 | Sinalização ao PCM de que há contrato ativo para iniciar o preventivo (evento/flag consumível) — **não** criar o plano preventivo aqui (fora de escopo) | AC-7 | 6 | `pnpm run test` | todo |
| 10 | pgTAP `supabase/tests/comercial_contratos_rls.test.sql`: RLS nos 4 perfis; `unique` em `proposta_id`; **atomicidade** — forçar falha na criação do plano e provar que o contrato não fica ativo; contrato legado com `comercial_contrato_id` nulo continua gerando recorrência | AC-1, AC-3, AC-4, AC-6 | 2, 3, 4 | CI `db-tests` | todo |
| 11 | `pnpm run ci:local` + Playwright (dev server local): proposta aceita→gerar contrato→ativar→conferir plano no Financeiro e oportunidade em `ganha`→encerrar e conferir que parcelas geradas permanecem + ROADMAP/STATE + glossário | todos | 1–10 | `pnpm run ci:local` | todo |

## Plano de teste
- **pgTAP (gate crítico)**: a **atomicidade** do AC-4 — contrato ativo sem plano de faturamento é o
  pior defeito possível desta story. Testar com falha injetada.
- **Regressão do E04**: provar que `fn_gerar_recorrencias` continua funcionando para contrato
  legado (`comercial_contrato_id` nulo) — o cron roda em produção todo dia 1.
- **Unit**: transições de status e `reajusteDevido` em virada de ano.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Quebrar o cron de recebíveis que já roda em produção | Task 1 confirma o consumo atual; coluna nullable (AC-6); pgTAP de regressão (task 10) |
| Contrato ativo sem plano de faturamento | RPC atômica (task 4) + pgTAP com falha injetada |
| Comercial escrevendo direto em `financeiro.*` | AC-5: RPC publicada pelo Financeiro; revisão adversarial confere |
| Encerrar contrato apagando recebível já gerado | AC-8 explícito + Playwright confere |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: vigência vencida, valor zero, falha ao criar plano, contrato legado)
- [ ] ADR conferido se a fronteira mudou · glossário atualizado (Contrato Comercial × Financeiro)
- [ ] ROADMAP/STATE atualizados
