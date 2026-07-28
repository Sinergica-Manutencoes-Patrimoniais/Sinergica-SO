---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agente entrevistador de cadastro de cliente/estrutura

> **Escopo entregue nesta sessão (2026-07-28): só schema + validação de roteiro.** O motor
> conversacional (a parte que de fato "entrevista" via LLM) é um sistema novo do tamanho de
> `pcm-ze-agent` — não uma extensão de algo existente como S23/S24/S25 foram. Implementar isso sem
> revisão de arquitetura é o tipo de decisão irreversível que o próprio `CLAUDE.md` pede pra parar
> e sinalizar antes de codar. ADR-0016 e as questões em aberto do `design.md` **continuam sem
> resposta** — não decidi sozinho.

## Plano
| #  | Task                                                                    | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|-------------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 0  | ADR-0016 (fronteira Atendimento→cadastro PCM via entrevista)            | —        | —          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 1  | Migration: `atendimento.roteiro_entrevista` + `entrevista_sessao` + RLS FORCE | AC-1,AC-2 | —     | `lint:migrations`/squawk verde                | done   |
| 1b | Domínio: `validarRoteiro` (nome + perguntas obrigatórios)                | AC-1     | 1          | `pnpm test` (4 testes novos)                   | done   |
| 2  | Config de roteiro — UI admin                                             | AC-1     | 1b         | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 3  | Motor de entrevista conversacional (edge function nova, tipo `pcm-ze-agent`) | AC-2 | 0,2     | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 4  | Montador de proposta (contato/CNPJ/árvore até 3 níveis)                 | AC-3     | 3          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 5  | Tela de confirmação — nada grava sem confirmar                          | AC-4     | 4          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 6  | Gravação transacional em cliente + estrutura + auditoria                 | AC-5     | 4,5        | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 7  | Cadastro manual preservado                                               | AC-6     | —          | já é verdade — nenhuma mudança tocou o cadastro manual | done (por não ter mexido) |
| 8  | Sanitização/defesa a prompt injection                                    | AC-4     | 3          | **não feito — ver SPEC_DEVIATION**            | bloqueado |

## Plano de teste
- Unidade: `validarRoteiro` (4 casos) — `apps/web/src/features/pcm/domain/roteiro-entrevista.test.ts`.
- Todo o resto: sem gate executável ainda, ver SPEC_DEVIATION.

## Divergências (SPEC_DEVIATION)
- [x] **Tasks 0, 2-6, 8 não implementadas.** O motor conversacional (condução da entrevista via
  LLM, normalização de resposta, montagem da árvore de estrutura, tela de confirmação, escrita
  transacional em cliente+estrutura) é uma peça de arquitetura nova — do tamanho de construir um
  segundo `pcm-ze-agent`, não uma extensão pontual. As questões em aberto do `design.md` (MVP com
  roteiro fixo ou já configurável? perfis de padrão de prédio por quem/como?) também não foram
  respondidas nesta sessão porque são decisões de produto, não técnicas. Resolução: esta story
  precisa de uma sessão própria de design (`@architect` + ADR-0016 revisado e aceito) antes de
  qualquer código do motor — o schema abaixo já está pronto pra receber essa implementação sem
  precisar de migration nova na maior parte dos casos.

## O que já existe pra próxima sessão puxar
- `atendimento.roteiro_entrevista` (perguntas configuráveis, mesmo formato `PassoFluxo` do fluxo
  comercial já usado em `pcm-ze-agent`) e `atendimento.entrevista_sessao` (estado entre turnos,
  mesmo padrão de `chamados_pendentes` da E02-S23) já existem e têm RLS.
- `apps/web/src/features/pcm/domain/roteiro-entrevista.ts` já valida o formato de roteiro — falta
  só o gateway/adapter/UI de CRUD (baixo risco, pode ser feito a qualquer momento) e,
  principalmente, o motor conversacional (alto risco, precisa de design revisado antes).

## Checklist de Definition of Done
- [x] Schema criado e revisado (migration + RLS)
- [x] Validação de roteiro implementada e testada
- [ ] ADR-0016 registrado e aceito
- [ ] Motor conversacional implementado
- [ ] `docs/STATE.md` atualizado
