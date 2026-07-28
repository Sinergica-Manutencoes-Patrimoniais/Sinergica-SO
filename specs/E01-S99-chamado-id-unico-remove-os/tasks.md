---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Chamado como ID único (remover numeração própria de OS)

> **Bloqueante antes da task 1:** responder as questões em aberto do `design.md`
> (S88 em produção? OS importada sem chamado?) e registrar **ADR-0014**.

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                               | Status |
|----|--------------------------------------------------------------------------|----------|------------|----------------------------------------------|--------|
| 0  | ADR-0014 substituindo o racional de numeração de OS (E01-S88)            | —        | —          | revisão @architect                            | todo   |
| 1  | Migration: `chamado_id` em `pcm.ordens_servico` (se faltar) + deprecar/dropar sequence/RPCs de OS | AC-1,AC-2 | 0 | `db-tests` verde                       | todo   |
| 2  | Parar de chamar `proximoNumeroOs`/`proximosNumerosOs` na criação de OS   | AC-1     | 1          | testes Deno de `os-from-task` verdes          | todo   |
| 3  | `contexto-tarefa-auvo.ts`: `numeroOs` → `numeroChamado` (CH-XXXX)        | AC-3,AC-4 | 1         | `pnpm test` (unit atualizado)                 | todo   |
| 4  | Push Auvo grava `CH-XXXX` no código externo da task                     | AC-3     | 3          | teste de integração do push Auvo              | todo   |
| 5  | Pull/webhook resolve OS por `chamado_id`                                 | AC-3     | 1          | teste de integração pull/webhook              | todo   |
| 6  | UI: substituir rótulos "OS NNNN" por `CH-XXXX`                           | AC-4     | 1          | Playwright (rótulo CH visível)                | todo   |
| 7  | Regra da OS importada sem chamado (conforme decisão da task 0)          | AC-3     | 0,1        | `pnpm test` (unit do caminho de import)       | todo   |
| 8  | Confirmar numeração de Chamado intacta (regressão)                       | AC-5     | 1          | testes existentes de chamado verdes           | todo   |

## Plano de teste
- Unidade: `contexto-tarefa-auvo` com `CH-XXXX`; caminho de import sem chamado.
- Integração: push (código externo = CH), pull/webhook (resolve por `chamado_id`), `db-tests`.
- Aceite: um teste por AC; Playwright para AC-4.
- Regressão: suíte de E01-S88 (numeração de chamado) continua verde.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] ADR-0014 registrado (substitui numeração de OS de E01-S88)
- [ ] Questões em aberto do `design.md` respondidas antes de codar
- [ ] Todos os AC verdes pelo gate executável
- [ ] `db-tests` (RLS/pgTAP) e testes Deno não pulados
- [ ] `docs/STATE.md` atualizado; `docs/adr/` e ROADMAP refletindo a reversão de S88
