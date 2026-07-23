---
name: tasks-E01-S88-chamados-entidade
description: Decomposição — Chamado (CH) entidade própria.
alwaysApply: false
---

# Tasks — Chamados (CH)

## Plano
| #  | Task                                                              | Cobre AC | Depende de | Gate (comando)          | Status |
|----|-------------------------------------------------------------------|----------|------------|-------------------------|--------|
| 1  | Migration `pcm.chamados` (RLS FORCE, sequence CH, origem, status) | AC-1     | design     | `pnpm lint:migrations`+pgTAP | todo |
| 2  | Migration eventos append-only + bucket Storage p/ anexo           | AC-4     | 1          | pgTAP                   | todo   |
| 3  | Domínio: Chamado (numeração, transições, cancelamento)            | AC-1,3,4 | —          | `pnpm test`             | todo   |
| 4  | Adapter Supabase de Chamado                                       | AC-1,2,3 | 1,3        | `pnpm test`             | todo   |
| 5  | `ChamadosPage` (lista + criação)                                 | AC-2     | 4          | browser                 | todo   |
| 6  | Gerar OS / enviar backlog a partir do Chamado                    | AC-3     | 3,4        | `pnpm test` + browser   | todo   |
| 7  | Cancelamento com justificativa + anexo obrigatórios              | AC-4     | 2,3        | `pnpm test` + browser   | todo   |
| 8  | Rename Ticket→Chamado na navegação + glossário                   | AC-5     | 5          | grep + browser          | todo   |

## Plano de teste
- Unidade: numeração única, transições válidas, cancelamento exige justificativa.
- Integração: sequence sob concorrência; upsert do Chamado; anexo no Storage.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Regra de cancelar Chamado já convertido em OS — decidir e registrar.

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes
- [ ] `pnpm run ci:local` verde; pgTAP RLS no CI
- [ ] Glossário + `docs/STATE.md` + ROADMAP atualizados
- [ ] ADR se a decisão Ticket↔Chamado for durável
