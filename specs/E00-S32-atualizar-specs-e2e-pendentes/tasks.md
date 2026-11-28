---
name: tasks-E00-S32-atualizar-specs-e2e-pendentes
description: Decomposição — atualizar os 43 testes E2E pendentes sem fixture de produção.
alwaysApply: false
---

# Tasks — Atualizar os testes E2E pendentes

> Story aberta em 2026-11-27 pela E00-S31. Nenhuma task iniciada. Lista viva:
> `apps/web/e2e-infra/pendentes.ts`.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| T1 | Atualizar seletores/fluxo dos 28 `desatualizado` e tirá-los de `pendentes.ts` | AC-1, AC-4 | — | `apps/web/e2e-infra/rodar-e2e-local.sh` após `supabase db reset` | pendente |
| T2 | Trocar o dado de produção dos 4 `producao` por dado fictício (teste ou `seed-e2e.sql`) | AC-1, AC-2, AC-4 | — | idem + `grep` sem nome/número de produção nos specs | pendente |
| T3 | Criar o dado fictício dos 3 `dado-local` | AC-1, AC-2, AC-4 | — | idem | pendente |
| T4 | Apurar e reclassificar os 7 `a-confirmar`; apagar com justificativa o que for obsoleto | AC-3, AC-5 | — | idem | pendente |
| T5 | Isolar a Edge Function/Auvo do `assessment` ou justificar a permanência como `ambiente` | AC-1, AC-4 | — | idem | pendente |
| T6 | Defeito real de produto achado no caminho vira story/PR próprio | AC-5 | T1–T5 | PR separado linkado | pendente |
