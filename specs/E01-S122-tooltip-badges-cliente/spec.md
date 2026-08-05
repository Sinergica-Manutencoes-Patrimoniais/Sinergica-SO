---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Tooltips explicando os badges do cliente

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 3, com print). "No cliente tem
> muita informação — Ativo, Cliente... O que significa cada coisa, coloque um tooltip."

## Contexto de código
- A listagem/cabeçalho de cliente (`ListaClientesPage`, Visão 360) mostra vários badges lado a lado
  que hoje não se explicam: **status** (Ativo/Inativo — E01-S91), **tipo** (Cliente/Lead/…),
  **marcação** livre por cor (E01-S91 `marcacoes-cliente.ts`, ex.: "Ativo com contrato", "Sem
  marcação") e o vínculo Auvo (`Auvo <id>`).
- Já existe `components/ui/Tooltip.tsx` (usado no Kanban) — reusar, sem lib nova.

## Resumo
Cada badge/seletor no bloco do cliente ganha um `Tooltip` com uma frase curta que diz **o que aquele
campo significa e o que ele decide** (não só repetir o rótulo). Puramente informativo — não muda
dado nem comportamento.

## Critérios de aceite

### AC-1: Todo badge do cliente tem tooltip explicativo
- **Dado** o cabeçalho/linha de um cliente com badges (status, tipo, marcação, contrato, Auvo id)
- **Quando** o operador passa o mouse (ou foca via teclado) em cada um
- **Então** aparece um tooltip explicando o significado — ex.: "Status operacional do cliente:
  Ativo = em atendimento; Inativo = sem contrato/atendimento no momento".

### AC-2: Distinguir status × tipo × marcação
- **Dado** os badges que hoje confundem (dois "Ativo" diferentes no print)
- **Quando** o operador lê os tooltips
- **Então** fica claro que um é **status** (Ativo/Inativo) e o outro é **marcação** de contrato
  (rótulo livre por cor), sem ambiguidade.

### AC-3: Não altera dados
- **Dado** os tooltips adicionados
- **Quando** o operador interage
- **Então** nenhum valor de cliente é gravado/alterado (só hover/foco).

## Casos de borda e erros
- Marcação livre criada pelo usuário (E01-S91): o tooltip explica o **conceito** de marcação, não
  o texto específico (que já é auto-explicativo pelo rótulo).
- Cliente sem `Auvo id`: badge/tooltip Auvo não aparece.

## Fora de escopo
- Redesenhar/consolidar os badges (só explicar os existentes).
- Glossário completo em página separada.

## Rastreabilidade
- Código: `pages/ListaClientesPage.tsx` e/ou cabeçalho da Visão 360, `components/ui/Tooltip.tsx`,
  `domain/marcacoes-cliente.ts` (referência dos conceitos).
- Estende: E01-S91 (marcações/status do cliente).
- ADRs relacionados: —
