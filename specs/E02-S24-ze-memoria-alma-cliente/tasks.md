---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Memória e "alma" por cliente para o Zé

> ADR-0015 já registrado (estratégia textual, RAG adiado). Formato da alma resolvido: **texto livre
> único** (mesmo padrão de `persona.base_conhecimento`, já existente e testado neste codebase).

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                                  | Status |
|----|--------------------------------------------------------------------------|----------|------------|-------------------------------------------------|--------|
| 1  | Migration: `atendimento.cliente_alma` + `cliente_memoria_resumo` + RLS FORCE | AC-1,AC-3 | —     | `lint:migrations`/squawk verde                  | done   |
| 2  | Composição de contexto: `comporContextoCliente` (alma+resumo) + `comporPromptPersona` estendido | AC-1,AC-2 | 1 | Deno test (não executado — sem Deno CLI) | done |
| 3  | Job de resumo rolante + descarte por retenção                            | AC-3     | 1          | **não feito — ver SPEC_DEVIATION**              | bloqueado |
| 4  | Tool de consulta de chamados sob demanda                                 | AC-5     | —          | **não feito — ver SPEC_DEVIATION**              | bloqueado |
| 5  | UI: editar "alma" na aba Comunicação da Visão 360 do cliente             | AC-6     | 1          | typecheck + vitest verdes                       | done   |
| 6  | Isolamento por `cliente_id` (segurança) — teste que prova não-vazamento  | AC-4     | 2          | Deno test (`comporContextoCliente`, isolamento por chamada) | done |
| 7  | Evals do prompt: usa contexto corretamente; budget respeitado            | AC-1,AC-2,AC-3 | 2,3    | **não feito — ver SPEC_DEVIATION**              | bloqueado |

## Plano de teste
- Unidade: `comporContextoCliente` (5 casos: vazio, só alma, só resumo, ambos, isolamento entre 2
  clientes), `validarAlma` (3 casos), `comporPromptPersona` com o novo parâmetro opcional (testes
  existentes seguem passando sem alteração — parâmetro é opt-in).
- Segurança: isolamento entre clientes garantido por construção — `buscarMemoriaCliente` sempre
  filtra por `clienteId` único (nunca lista "todos"); `comporContextoCliente` só recebe o que já
  veio filtrado. Não há teste de integração ponta a ponta (exige Postgres real).
- Eval LLM (`ia/`): **não criado** — ver SPEC_DEVIATION.
- Aceite: Playwright não rodado (pendente teste local do Lucas).

## Divergências (SPEC_DEVIATION)
- [x] **Task 3 (job de resumo rolante) não implementada.** A tabela `cliente_memoria_resumo` existe
  e já é lida/injetada no prompt, mas **nada a preenche ainda** — fica vazia até alguém rodar um job
  (cron + edge function + chamada de LLM pra resumir). Motivo: decidir frequência/custo desse job é
  uma escolha de produto (quanto custa rodar resumo pra todos os clientes ativos, com que
  periodicidade) que não me cabe decidir sozinho. Resolução: Lucas define frequência aceitável;
  depois é uma edge function nova (`pcm-cliente-memoria-resumo` ou similar) agendada via pg_cron,
  reusando o padrão de `pcm-auvo-tasks-import` (cron horário existente).
- [x] **Task 4 (tool de consulta de chamados sob demanda) não implementada.** O Zé hoje não tem
  mecanismo de "tool calling" via OpenRouter (extração é sempre 1 chamada JSON, sem function
  calling) — adicionar isso é uma mudança de arquitetura da integração com o LLM, não uma tarefa
  pontual. Fica para uma story própria se/quando for prioridade.
- [x] **Task 7 (evals) não implementada.** Sem harness de eval configurado neste ambiente.

## Checklist de Definition of Done
- [x] Migration + composição de contexto + isolamento implementados e revisados
- [x] UI de edição da alma funcional
- [ ] Job de resumo rolante (SPEC_DEVIATION — decisão de produto pendente)
- [ ] Tool de consulta de chamados (SPEC_DEVIATION — mudança de arquitetura maior)
- [ ] Evals (SPEC_DEVIATION — sem harness)
- [ ] `docs/STATE.md` atualizado
