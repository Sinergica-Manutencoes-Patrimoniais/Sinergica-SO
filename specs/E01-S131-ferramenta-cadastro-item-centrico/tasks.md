---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Ferramenta: cadastro item-cêntrico

> Tier pequeno. Reusa `ferramenta_unidades`. Migração, se houver, é **aditiva** (nunca destrói dado
> existente). Preservar alocação/reserva/sync Auvo.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Domínio: form de item (código/identificação obrigatório), remove `quantidadeTotal` como entrada; `quantidade` = contagem derivada de unidades | AC-1,AC-3 | — | vitest | done |
| 2 | Migration aditiva (se necessário): `codigo` obrigatório/único no item; nada destrutivo | AC-1,AC-4 | 1 | lint:migrations | done — não necessária |
| 3 | Adapter: criar item = criar unidade; listar por item; contagem por tipo/categoria | AC-1,AC-2,AC-3 | 1 | typecheck | done |
| 4 | UI `FerramentasPage`: cadastro 1-item, sem campo quantidade; lista item-a-item com agrupamento por categoria | AC-1,AC-3 | 3 | typecheck | done |
| 5 | Regressão: atribuir/devolver/baixar/reservar/alocar (cliente/técnico) por item continuam OK | AC-2,AC-4 | — | vitest | done |
| 6 | e2e: cadastrar 2 chaves de fenda vira 2 registros distintos, cada um rastreável | AC-1,AC-2 | — | playwright (Lucas) | todo |

## Plano de teste
- Unidade: quantidade derivada = contagem de unidades ativas; código único.
- Aceite: Playwright — cadastro item-cêntrico; reserva/alocação por item; dados antigos aparecem.

## Riscos
- Não quebrar reserva/alocação/sync que dependem de `ferramenta_unidades`.
- Não digitar quantidade em lugar nenhum (evitar reintroduzir a camada agregada).

## Decisão de schema
- `0086_E01-S63_ferramenta_unidades.sql` já declara `codigo text not null unique`; não criar
  migration duplicada. A alteração é de fluxo/UI e preserva integralmente os dados legados.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Migração (se houver) aditiva, dado antigo intacto
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
