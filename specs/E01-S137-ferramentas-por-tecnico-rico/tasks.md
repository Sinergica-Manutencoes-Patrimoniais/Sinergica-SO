---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Ferramentas por Técnico rico (todos + histórico + transfer-list)

> Tier pequeno-médio (UI + reuso de unidades/movimentação; sem migration). Interage com E01-S131
> (item-cêntrico) — se as duas rodarem juntas, alinhar o modelo de unidade.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Adapter/application: listar TODOS os técnicos ativos + posse atual + histórico por técnico | AC-1,AC-2 | typecheck | done |
| 2 | UI: lista de todos os técnicos com resumo (posse, divergência Auvo) | AC-1 | typecheck | done |
| 3 | Componente transfer-list (dual-list: disponíveis ↔ posse do técnico), com busca/filtro | AC-3,AC-4 | vitest | todo |
| 4 | Modal do técnico: info + ferramentas atuais + histórico + transfer-list; atribuir/devolver em lote | AC-2,AC-3,AC-4,AC-5 | typecheck | todo |
| 5 | Guardas: só-leitura sem escrita; unidade de outro técnico não transferível; regra "só disponível atribui" | AC-5,AC-borda | vitest | todo |
| 6 | e2e: abrir técnico, ver histórico, atribuir 2 unidades pelo transfer-list, devolver 1 | AC-2,AC-3,AC-4 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: transfer-list (mover/desfazer/confirmar); regra de disponibilidade.
- Aceite: Playwright — todos os técnicos listados; modal com histórico; atribuição em lote persiste.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
