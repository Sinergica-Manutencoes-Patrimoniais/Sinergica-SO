---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Filtro por cliente na tela de Chamados

> Achado: `ChamadosGateway.listar`/`FiltrosChamados.clienteId` e o adapter (`.eq("cliente_id", ...)`)
> **já existiam** desde E01-S88 — era um gap 100% de UI (nenhum lugar chamava com filtro).

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|---------------------------------------------------------------|----------|------------|-----------------------------------------|--------|
| 1  | Seletor de cliente (`<select>`, lista de clientes já carregada por `carregarDadosAberturaOs`) no header | AC-1 | — | typecheck + vitest verdes | done |
| 2  | Passar `clienteFiltro` pro `listarChamados` (filtro já existia no gateway/adapter) | AC-1,AC-3 | 1 | typecheck + vitest verdes | done |
| 3  | Opção "Todos os clientes" (value vazio) volta lista completa | AC-2     | 1          | typecheck + vitest verdes                | done   |

## Plano de teste
- Regressão: suíte de testes existente (723 testes) segue verde — nenhuma lógica de domínio nova
  (filtro já era suportado pelo gateway).
- Aceite: Playwright não rodado (pendente teste local do Lucas).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma — feature simples, sem desvio.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente pelo Lucas
- [ ] `docs/STATE.md` atualizado
