---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Todas as listagens/seletores de cliente mostram só Ativos

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|--------------------------------|--------|
| 1  | Auditoria: listar todo ponto que consulta `pcm.clientes` pra popular seletor (grep de `.from("clientes")` em toda `apps/web/src/features/pcm`) | AC-1 | — | revisão manual | done |
| 2  | Adicionar `.eq("ativo", true)` onde faltar (Chamados, OS, Ferramenta-Cliente, Responsáveis, etc.) | AC-1 | 1 | typecheck + vitest | done |
| 3  | `ListaClientesPage`: filtro padrão inicial vira "Ativo"              | AC-2     | —          | Playwright                    | done   |
| 4  | Confirmar Visão 360 direta não filtra por ativo (acesso a histórico) | AC-3     | —          | revisão de código             | done   |

## Resultado da auditoria (task 1/2)
Todo `listarClientes()`/seletor de formulário já filtrava `ativo=true` (Nova OS/Chamado, Agenda do
Técnico, Equipamentos, Apontamento de Horas, Tickets, Grupos de Cliente, PMOC) — a suspeita "hoje é
misto" do spec.md não se confirmou nos seletores; só a `ListaClientesPage` (AC-2) tinha o padrão
errado ("Todos" em vez de "Ativo"), corrigido nesta story. Os únicos pontos sem filtro de `ativo`
são mapas de resolução de nome por id (`clientesPorId`, `buscarCliente`, `.in("id", clienteIds)`) —
usados para exibir dado já existente (OS/equipamento/agenda antigos, Visão 360), não para oferecer
opção de seleção — filtrar esses quebraria AC-3 (acesso a histórico de cliente inativo).

## Plano de teste
- Aceite: Playwright — cliente inativo não aparece em nenhum seletor novo de formulário; lista
  principal abre já filtrada em "Ativo"; Visão 360 de cliente inativo (link direto) continua abrindo.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome — nenhuma mudança de
  seletor foi necessária além do padrão de `ListaClientesPage`)
- [ ] Playwright rodado localmente
- [ ] `docs/STATE.md` atualizado
