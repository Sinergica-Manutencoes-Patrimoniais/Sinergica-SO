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
| 1  | Abas "Por Técnico" / "Por Cliente" em `FerramentasPorTecnicoPage`    | AC-1,AC-2 | —         | Playwright (troca de aba)       | done   |
| 2  | Seção "Por Cliente" reusa gateway/adapter de E01-S106                | AC-3     | 1          | typecheck + vitest              | done   |

## Implementação
`FerramentaAlocacaoClienteGateway` ganhou 2 métodos de leitura (`listarAtivas` — todas as
alocações ativas, qualquer cliente; `listarClientesAtivos` — seletor de cliente do formulário) —
CRUD (`alocar`/`devolver`) não foi tocado/duplicado (AC-3). Aba "Por Cliente" reusa exatamente
`alocarFerramenta`/`devolverFerramenta`/`listarFerramentasDisponiveis` já usados pelo painel da
Visão 360 (E01-S106) — os dois pontos de entrada continuam funcionando lado a lado (questão aberta
já resolvida: painel da Visão 360 fica).

## Plano de teste
- Regressão: fluxo "Por Técnico" continua idêntico (nenhuma linha do estado/JSX dele foi alterada,
  só envolvida num fragment condicional pela aba).
- Aceite: Playwright cobrindo alocar/devolver ferramenta de cliente na nova aba — pendente teste
  local do Lucas.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Questão em aberto resolvida
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
