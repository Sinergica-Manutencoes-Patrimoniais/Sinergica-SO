---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — <nome da feature>

> Decomposição da implementação. Cada task **mapeia para um ou mais `AC-N`** (rastreabilidade
> spec → task → commit) e tem um **gate executável**: o comando que prova que está pronta.
> Marque `[P]` nas tasks paralelas (sem dependência entre si). Um commit por task.
> Na coluna "Cobre AC", escreva **cada token por extenso** (`AC-1, AC-2`) — o gate
> `eval-spec-fidelity.mjs` procura o token completo; `AC-1,2` deixa o `AC-2` invisível.

## Plano
| #  | Task                                  | Cobre AC | Depende de | Gate (comando)         | Status |
|----|---------------------------------------|----------|------------|------------------------|--------|
| 1  | <modelar agregado no domínio>         | AC-1     | —          | `<test do domínio>`    | todo   |
| 2  | <caso de uso na application>          | AC-1,2   | 1          | `<test do caso de uso>`| todo   |
| 3  | <adapter/repo na infrastructure>      | AC-2     | 1          | `<test de integração>` | todo   |
| 4  | <endpoint na interface> `[P]`         | AC-1,2   | 2,3        | `<test de aceite>`     | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: <invariantes do domínio, value objects>
- Integração: <adapters, repos, contratos>
- Aceite: <um teste por AC da spec.md — é o gate de aceite>

## Divergências (SPEC_DEVIATION)
> Se a implementação precisar fugir da spec, registre aqui antes de seguir (ver `CLAUDE.md`).
- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADRs de decisões difíceis de reverter registrados
- [ ] Glossário atualizado se mudou
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
