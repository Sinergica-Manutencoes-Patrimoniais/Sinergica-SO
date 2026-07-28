---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Memória e "alma" por cliente para o Zé

> Feature de IA/LLM: trilha `ia/` com `@prompt-engineer` (prompt base versionado, prompt de resumo,
> evals de uso de contexto e de isolamento). Antes da task 1: registrar **ADR-0015** e resolver
> questões em aberto do `design.md` (formato da alma, frequência do resumo, retenção final).

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                                  | Status |
|----|--------------------------------------------------------------------------|----------|------------|-------------------------------------------------|--------|
| 0  | ADR-0015 (estratégia de memória: textual no MVP, RAG adiado)             | —        | —          | revisão @architect                              | todo   |
| 1  | Migration: `atendimento.cliente_alma` + `cliente_memoria_resumo` + RLS FORCE | AC-1,AC-3 | 0     | `db-tests` verde (RLS)                          | todo   |
| 2  | Composição de contexto: base + alma + janela crua (por cliente)          | AC-1,AC-2 | 1          | `pnpm test` (unit da composição)                | todo   |
| 3  | Job de resumo rolante + descarte por retenção                            | AC-3     | 1          | teste de integração do job                       | todo   |
| 4  | Tool de consulta de chamados sob demanda                                 | AC-5     | —          | `pnpm test` (unit da tool)                       | todo   |
| 5  | UI: editar "alma" no cadastro/resumo do cliente                          | AC-6     | 1          | Playwright (edição persiste)                     | todo   |
| 6  | Isolamento por `cliente_id` (segurança) — teste que prova não-vazamento  | AC-4     | 2          | eval/teste de isolamento (A não vê B)            | todo   |
| 7  | Evals do prompt: usa contexto corretamente; budget respeitado            | AC-1,AC-2,AC-3 | 2,3    | eval em `ia/`                                    | todo   |

## Plano de teste
- Unidade: composição de contexto, retenção/descarte, tool de chamados.
- Segurança: isolamento entre clientes (AC-4) — obrigatório verde.
- Eval LLM (`ia/`): uso correto de alma/memória; não-vazamento; budget.
- Aceite: um teste por AC; Playwright para AC-6.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] ADR-0015 registrado; questões em aberto do design respondidas
- [ ] Todos os AC verdes pelo gate executável
- [ ] Teste de isolamento entre clientes verde (segurança)
- [ ] RLS FORCE nas tabelas novas; `db-tests` não pulado
- [ ] Evals do prompt versionado verdes
- [ ] `docs/STATE.md` atualizado
