---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Todas as listagens/seletores de cliente mostram só Ativos

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------|--------|
| 1  | Auditoria: listar todo ponto que consulta `pcm.clientes` pra popular seletor (grep de `.from("clientes")` em toda `apps/web/src/features/pcm`) | AC-1 | — | revisão manual | todo |
| 2  | Adicionar `.eq("ativo", true)` onde faltar (Chamados, OS, Ferramenta-Cliente, Responsáveis, etc.) | AC-1 | 1 | typecheck + vitest | todo |
| 3  | `ListaClientesPage`: filtro padrão inicial vira "Ativo"              | AC-2     | —          | Playwright                    | todo   |
| 4  | Confirmar Visão 360 direta não filtra por ativo (acesso a histórico) | AC-3     | —          | revisão de código             | todo   |

## Plano de teste
- Aceite: Playwright — cliente inativo não aparece em nenhum seletor novo de formulário; lista
  principal abre já filtrada em "Ativo"; Visão 360 de cliente inativo (link direto) continua abrindo.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
