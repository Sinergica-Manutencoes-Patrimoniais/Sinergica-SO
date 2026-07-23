---
name: tasks-E01-S90-inspecao-assessment
description: Decomposição — inspeção como assessment.
alwaysApply: false
---

# Tasks — Inspeção-assessment

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)          | Status |
|----|-------------------------------------------------------------------|----------|------------|-------------------------|--------|
| 1  | Migration: inspeção-assessment + itens (destino, responsável)     | AC-1,3   | design     | `pnpm lint:migrations`+pgTAP | todo |
| 2  | Domínio: assessment + item + transições de destino                | AC-1,3   | —          | `pnpm test`             | todo   |
| 3  | Mapeador questionário Auvo (snapshot E01-S15) → itens (idempotente)| AC-2    | 1,2        | teste Deno/unit         | todo   |
| 4  | Adapter + `InspecoesPage`: criar assessment, listar itens         | AC-1,2   | 1,2        | browser                 | todo   |
| 5  | Derivar item → Chamado (S88) / Backlog (S83) / OS + responsável   | AC-3     | 2,4        | `pnpm test` + browser   | todo   |
| 6  | Seção de assessment na Visão 360                                  | AC-4     | 4          | browser                 | todo   |

## Plano de teste
- Unidade: idempotência do mapeador, transições de destino, responsável.
- Integração: snapshot Auvo → itens; derivação cria Chamado/Backlog/OS reais.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Formato do questionário Auvo pode variar — mapeador tolerante; registrar campos assumidos.

## Checklist de Definition of Done
- [ ] AC-1..AC-4 verdes
- [ ] `pnpm run ci:local` verde; pgTAP no CI
- [ ] Depende de S88/S83 mergeadas
- [ ] `docs/STATE.md` + ROADMAP atualizados
