---
name: tasks
description: Decomposição e gates — cliente-360 mais rico.
alwaysApply: false
---

# Tasks — Cliente-360 mais rico

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0075`: `pcm.clientes.detalhes jsonb` | — | — | `pnpm run lint:migrations` | done |
| 2  | `_shared/auvo/registry/clientes.ts`: `fromAuvo` popula `detalhes.contacts` (array completo) | AC-1, AC-4 | 1 | leitura (sem Deno CLI local) | done |
| 3  | `cliente-360-gateway.ts`: `ClienteHeader.detalhes`, novo `listarGruposCliente` | AC-1, AC-2 | — | typecheck | done |
| 4  | `supabase-cliente-360-adapter.ts`: `buscarCliente` seleciona `detalhes`; implementa `listarGruposCliente` (`cliente_ids @> [id]`) | AC-1, AC-2 | 3 | typecheck | done |
| 5  | `obter-visao-cliente.ts`: `VisaoCliente.grupos`, isolado com try/catch | AC-2 | 3, 4 | `pnpm test` | done |
| 6  | `VisaoClientePage.tsx`: cards Contatos/Grupos no Resumo; aba Financeiro reescrita | AC-1, AC-2, AC-3 | 5 | manual | done |
| 7  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-6 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Unidade: `obterVisaoCliente` — falha de `listarGruposCliente` não derruba o resto (mesmo padrão de
  equipamentos).
- Manual: cliente com múltiplos contatos e grupo associado; aba Financeiro mostra proxy sem prometer
  dado inexistente.

## Divergências (SPEC_DEVIATION)
- [x] Escopo cortado (cidade/estado/cep, coordenadas, customFields) por falta de acesso à API Auvo real
  nesta sessão — registrado em `design.md`, não é omissão silenciosa.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
