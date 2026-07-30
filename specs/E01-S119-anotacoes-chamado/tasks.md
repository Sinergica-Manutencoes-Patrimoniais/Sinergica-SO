---
name: tasks
description: Decomposição executável da E01-S119.
alwaysApply: true
---

# Tasks — Anotações do Chamado

## Plano

| Task | Entrega | AC | Gate | Estado |
| --- | --- | --- | --- | --- |
| 1 | Criar `pcm.chamados_anotacoes` append-only, com RLS e autor imutável | AC-1, AC-3, AC-4 | `pnpm run lint:migrations` | done |
| 2 | Adicionar tipos, validação e gateway de leitura/escrita | AC-1, AC-2, AC-4 | `pnpm --filter @sinergica/web test -- chamados.test.ts` | done |
| 3 | Exibir lista e formulário no `ChamadoPainel` | AC-1 a AC-4 | `pnpm run typecheck` | done |

## Plano de teste

- AC-1: teste de caso de uso normaliza texto e persiste com usuário autenticado.
- AC-2: adapter pede lista em `created_at desc`; UI formata data/hora em `pt-BR`.
- AC-3: tabela referencia `chamados`, não `ordens_servico`; painel sempre usa `chamadoId`.
- AC-4: teste rejeita vazio antes de I/O; schema e UI não expõem update/delete.

## Checklist de Definition of Done

- [x] AC-1 a AC-4 cobertos por implementação e testes.
- [ ] Migração `0164` aplicada em produção pelo deploy da PR.
- [x] `pnpm run ci:local` verde após integração.
