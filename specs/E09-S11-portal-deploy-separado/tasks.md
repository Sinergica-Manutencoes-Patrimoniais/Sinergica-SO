---
name: tasks-E09-S11-portal-deploy-separado
description: Decomposição — deploy separado do portal.
alwaysApply: false
---

# Tasks — Deploy separado do portal

> Implementação local concluída em 2026-07-21: `apps/portal`, `packages/portal-core`, Netlify e gate
> anti-import. Build/teste local verdes; site/subdomínio do portal é gate externo pós-merge porque
> este workspace não possui autenticação/vínculo Netlify para criar o segundo site.

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)      | Status |
|----|---------------------------------------------------------------|----------|------------|---------------------|--------|
| 1  | Mover read-models/tipos reusados para `packages/` compartilhado | AC-4   | E09-S01..S10 | `pnpm test`+build   | done   |
| 2  | Entry/app separado do portal (`apps/portal` ou entry Vite)     | AC-1     | 1          | build               | done   |
| 3  | Gate de build anti-import interno (falha se vazar)            | AC-1     | 2          | script de CI        | done   |
| 4  | Config Netlify + subdomínio + envs (site separado)           | AC-2     | 2          | UAT Netlify pós-merge | todo |
| 5  | Revisar que RLS não mudou (E09-S01 intacta)                  | AC-3     | —          | smoke SQL remoto     | done   |

## Plano de teste
- Build: gate confirma ausência de imports internos no bundle do portal.
- Regressão: SO interno continua buildando/funcionando após mover código para `packages/`.
- Aceite: um teste/verificação por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência de código prevista; resta o gate operacional externo acima.

## Checklist de Definition of Done
- [x] AC-1, AC-3 e AC-4 verdes; código/build do AC-2 verde
- [x] `pnpm run ci:local` verde
- [ ] Site separado do portal no ar (subdomínio) — requer vínculo/autenticação Netlify
- [x] RLS de E09-S01 confirmada intacta por smoke SQL transacional remoto
- [x] `docs/STATE.md` + ROADMAP atualizados
