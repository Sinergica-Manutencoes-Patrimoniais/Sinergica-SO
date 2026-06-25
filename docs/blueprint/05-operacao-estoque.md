---
name: blueprint-operacao-estoque
description: Requirements do módulo Operação & Estoque (catálogo, materiais, custo de OS). Puxe ao planejar specs de estoque ou Volante.
alwaysApply: false
---

# Blueprint — Operação & Estoque

> Schema Postgres: `estoque` · Feature: `apps/web/src/features/operacao/`

## Problema
Materiais usados em OS eram registrados ad-hoc no Auvo sem controle de estoque ou custo unitário.
Impossível calcular margem real ou planejar reposição.

## Fluxos e regras de negócio

### Catálogo de materiais
- Cada material: nome, categoria, unidade, preço de referência, markup padrão (%).
- Fonte primária: PCM (Sinérgica define); espelhado no Auvo para o técnico selecionar em campo.

### Consumo em OS
- Técnico registra materiais usados no Auvo (ID do item do catálogo + quantidade).
- Webhook de conclusão da OS traz lista de peças consumidas.
- PCM consolida: custo dos materiais da OS = Σ(quantidade × preço_referência × (1 + markup)).

### Estoque (futuro — Mês 3+)
- Controle de entradas/saídas por material.
- Ponto de reposição configurável por item.
- Alertas automáticos quando abaixo do mínimo.

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `Material` | Item do catálogo com preço referência e markup |
| `MovimentacaoEstoque` | Entrada ou saída de material (OS, compra, ajuste) |
| `EstoqueAtual` | View do saldo atual por material |

## Integrações
- **Auvo**: catálogo espelhado via API; peças consumidas via webhook.
- **PCM**: vínculo de peças consumidas com OS.
- **Financeiro**: custo de materiais alimenta `CustoOS`.
