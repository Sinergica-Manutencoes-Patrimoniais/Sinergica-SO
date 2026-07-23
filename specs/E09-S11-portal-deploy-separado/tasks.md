---
name: tasks-E09-S11-portal-deploy-separado
description: Decomposição — deploy separado do portal.
alwaysApply: false
---

# Tasks — Deploy separado do portal

> Implementação local concluída em 2026-07-21: `apps/portal`, `packages/portal-core`, Netlify e gate
> anti-import. Build/teste local verdes; deploy preview ainda é gate externo.

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)      | Status |
|----|---------------------------------------------------------------|----------|------------|---------------------|--------|
| 1  | Mover read-models/tipos reusados para `packages/` compartilhado | AC-4   | E09-S01..S10 | `pnpm test`+build   | done   |
| 2  | Entry/app separado do portal (`apps/portal` ou entry Vite)     | AC-1     | 1          | build               | done   |
| 3  | Gate de build anti-import interno (falha se vazar)            | AC-1     | 2          | script de CI        | done   |
| 4  | Config Netlify + subdomínio + envs                           | AC-2     | 2          | deploy preview      | todo   |
| 5  | Revisar que RLS não mudou (E09-S01 intacta)                  | AC-3     | —          | smoke SQL remoto     | done   |

## Plano de teste
- Build: gate confirma ausência de imports internos no bundle do portal.
- Regressão: SO interno continua buildando/funcionando após mover código para `packages/`.
- Aceite: um teste/verificação por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde; deploy do portal no ar (subdomínio)
- [x] RLS de E09-S01 confirmada intacta por smoke SQL transacional remoto
- [ ] `docs/STATE.md` + ROADMAP atualizados
