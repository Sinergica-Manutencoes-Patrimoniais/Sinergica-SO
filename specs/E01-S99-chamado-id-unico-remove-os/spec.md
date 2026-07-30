---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Chamado como ID único (remover numeração própria de OS)

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 9. Ver `product.md` e `design.md`.

## Resumo
O Chamado (`CH-XXXX`) passa a ser o **único identificador humano** de ponta a ponta. A Ordem de
Serviço deixa de gerar `OS-XXXX`: quando um Chamado vira OS, ela herda o `CH-XXXX` do Chamado de
origem. A task correspondente no Auvo recebe `CH-XXXX` no campo **código externo**.

## Critérios de aceite

### AC-1: OS não gera número próprio
- **Dado** um Chamado com data e técnico definidos
- **Quando** ele vira OS
- **Então** a OS **não** recebe um `OS-XXXX`; o identificador exibido é o `CH-XXXX` do Chamado; **e**
  a sequence/RPC de numeração de OS (`fn_proximo_numero_os`, `fn_proximos_numeros_os`) não é chamada.

### AC-2: Vínculo Chamado ↔ OS
- **Dado** uma OS criada a partir de um Chamado
- **Quando** persistida
- **Então** ela referencia o Chamado de origem (`chamado_id`), e `chamados.status = "convertido_os"`
  com `ordemServicoId` apontando para a OS (flag/estado já existente, sem número novo).

### AC-3: Código externo do Auvo = CH-XXXX
- **Dado** uma OS enviada ao Auvo
- **Quando** a task é criada/atualizada
- **Então** o campo **código externo** da task recebe o `CH-XXXX`; **e** o pull/webhook resolve a OS
  local pelo `chamado_id` (não por um número de OS).

### AC-4: UI mostra CH-XXXX no lugar de OS-XXXX
- **Dado** qualquer tela que hoje exibe "OS NNNN"
- **Quando** renderizada
- **Então** mostra o `CH-XXXX` correspondente.

### AC-5: Numeração de Chamado inalterada
- **Dado** a criação de um novo Chamado
- **Quando** salvo
- **Então** ele recebe `CH-XXXX` pela numeração de chamado já existente (E01-S88) — este mecanismo
  **não** é alterado por esta story.

## Casos de borda e erros
- **OS importada do Auvo sem Chamado de origem** → comportamento definido pela questão em aberto do
  `design.md` (criar Chamado retroativo vs. referência à task). **Bloqueante:** resolver antes de
  implementar AC-3 para o caminho de import.
- S88 já em produção → seguir plano de dados (questão em aberto do `design.md`).
- Push Auvo sem `CH-XXXX` resolvido → não enviar código externo vazio; sinalizar.

## Fora de escopo
- Remover a entidade `pcm.ordens_servico` (mantém UUID interno).
- Alterar SLA (E01-S100), datas do chamado (E01-S101), Kanban/Hub além da numeração.

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md`
- Código: `supabase/functions/_shared/auvo/os-from-task.ts`,
  `apps/web/src/features/pcm/domain/contexto-tarefa-auvo.ts`, `domain/chamados.ts`.
- ADRs: **ADR-0014** (substitui numeração de OS de E01-S88); relaciona ADR-0001, ADR-0010.
