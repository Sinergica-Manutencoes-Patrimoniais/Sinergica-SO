---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agente entrevistador de cadastro de cliente/estrutura

> Feature de IA/LLM: trilha `ia/` com `@prompt-engineer` (prompt de condução/normalização + evals +
> defesa a injection). Antes da task 1: registrar **ADR-0016** e resolver questões em aberto do
> `design.md` (sentido de "área do cliente"; MVP roteiro fixo vs. configurável; perfis de padrão).

## Plano
| #  | Task                                                                    | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|-------------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 0  | ADR-0016 (fronteira Atendimento→cadastro PCM via entrevista)            | —        | —          | revisão @architect                            | todo   |
| 1  | Migration: `atendimento.roteiro_entrevista` + `entrevista_sessao` + RLS FORCE | AC-1,AC-2 | 0     | `db-tests` verde (RLS)                        | todo   |
| 2  | Config de roteiro (perguntas/ordem/padrões) — modelo + UI admin         | AC-1     | 1          | Playwright (roteiro salvo é usado)            | todo   |
| 3  | Motor de entrevista conversacional (uma pergunta/vez, normaliza, retomável) | AC-2 | 1,2        | `pnpm test` (unit do motor) + eval em `ia/`   | todo   |
| 4  | Montador de proposta (contato/CNPJ/árvore até 3 níveis)                 | AC-3     | 3          | `pnpm test` (unit do montador)                | todo   |
| 5  | Tela de confirmação (revisar/ajustar) — nada grava sem confirmar         | AC-4     | 4          | Playwright (sem confirmação = nada gravado)   | todo   |
| 6  | Gravação transacional em cliente + estrutura + auditoria                 | AC-5     | 4,5        | teste de integração (rollback em falha)       | todo   |
| 7  | Garantir cadastro manual preservado                                      | AC-6     | —          | Playwright (fluxo manual intacto)             | todo   |
| 8  | Sanitização/defesa a prompt injection nas respostas livres              | AC-4     | 3          | eval de injection em `ia/`                     | todo   |

## Plano de teste
- Unidade: motor de entrevista, montador de proposta, validações (CNPJ).
- Segurança: **nada gravado sem confirmação** (AC-4 bloqueante); injection (AC-4).
- Integração: gravação transacional com rollback; auditoria em `audit.*`.
- Eval LLM (`ia/`): normalização de resposta e montagem de árvore.
- Aceite: um teste por AC; Playwright para AC-1, AC-4, AC-6.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] ADR-0016 registrado; questões em aberto do design respondidas
- [ ] Todos os AC verdes pelo gate executável
- [ ] Teste "não grava sem confirmação" verde (AC-4)
- [ ] RLS FORCE + auditoria; `db-tests` não pulado
- [ ] Evals do prompt versionado verdes
- [ ] `docs/STATE.md` atualizado
