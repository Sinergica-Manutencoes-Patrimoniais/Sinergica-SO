---
name: tasks
description: Decomposição e gates — criação de tarefa rica (anexos/produtos/keywords) PCM→Auvo.
alwaysApply: false
---

# Tasks — Criação de tarefa rica

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Verificar contrato real de `PUT /tasks/{id}/attachments` e `/products` com credencial + tarefa de teste (formato do anexo!) | todos | credencial Auvo | manual (curl) | todo |
| 2 | Gerador do anexo de contexto (domínio puro: OS+equipamento+histórico → texto/documento) + testes | AC-1 | — | `pnpm run test` | todo |
| 3 | `pcm-auvo-create-task`: etapa de enriquecimento pós-criação (attachments, products, keywords) com erro isolado e idempotência | AC-1..4 | 1, 2 | `deno test` | todo |
| 4 | UI: peças previstas no modal de Nova OS (campo simples referenciando espelho de produtos) + status de enriquecimento na OS | AC-2, AC-3 | 3 | `pnpm run test` | todo |
| 5 | `pnpm run ci:local` + ROADMAP/STATE + teste manual: criar OS piloto e conferir no app do técnico | todos | 1-4 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: gerador de contexto, idempotência do enriquecimento.
- Deno: fluxo criação→enriquecimento com falha parcial simulada.
- Manual: OS piloto real, verificação no app de campo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
