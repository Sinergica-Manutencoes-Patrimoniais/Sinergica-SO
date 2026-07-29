---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — "Ferramentas por Técnico" vira hub único (técnico + cliente)

> **Resolvido (Lucas, 2026-07-29):** painel na Visão 360 **fica** (fácil acesso a tudo do cliente
> num só lugar). O hub em "Ferramentas por Técnico" é adicional, não substitui.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|------------------------------------------------------------------------|----------|------------|---------------------------------|--------|
| 1  | Abas "Por Técnico" / "Por Cliente" em `FerramentasPorTecnicoPage`    | AC-1,AC-2 | —         | Playwright (troca de aba)       | todo   |
| 2  | Seção "Por Cliente" reusa gateway/adapter de E01-S106                | AC-3     | 1          | typecheck + vitest              | todo   |

## Plano de teste
- Regressão: fluxo "Por Técnico" continua idêntico.
- Aceite: Playwright cobrindo alocar/devolver ferramenta de cliente na nova aba.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [x] Questão em aberto resolvida
- [ ] Todos os AC verdes pelo gate executável
- [ ] `docs/STATE.md` atualizado
