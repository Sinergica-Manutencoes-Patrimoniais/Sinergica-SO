---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Reorganização da nav do PCM (Tipos de Tarefa, PMOC, Preventivo)

> **Fonte da verdade.** Origem: Lucas (2026-08-04, itens 3, 7 e 8 — todos editam o `PCM_NAV`).
> Reunidos numa story só (mesma estrutura, mesmo arquivo).

## Contexto de código
- `PCM_NAV` em `apps/web/src/app/HomePage.tsx` (grupos: OPERAÇÃO, CADASTROS, CONFIGURAÇÕES,
  PREVENTIVO, RELATÓRIOS).
- Estado atual relevante:
  - **CADASTROS** contém `{ label: "Tipos de Tarefa", view: "tipos-tarefa" }`.
  - **PREVENTIVO** contém `{ "PMOC", view: "pmoc" }`, `{ "Cronograma" }` (**sem `view:`**),
    `{ "Preventivas" }` (**sem `view:`**). Cronograma e Preventivas são **itens mortos** (nenhuma
    tela wired — o conteúdo real de cronograma/preventivas vive dentro do `PmocPage` em abas).

## Resumo
Três edições de navegação: (3) mover "Tipos de Tarefa" pra CONFIGURAÇÕES; (7) mover "PMOC" pro grupo
OPERAÇÃO; (8) remover o grupo PREVENTIVO inteiro (Cronograma e Preventivas são itens mortos; PMOC já
saiu pra Operação). Só nav — nenhuma tela nova nem removida de fato (PMOC continua a mesma página).

## Critérios de aceite

### AC-1: "Tipos de Tarefa" em Configurações (item 3)
- **Dado** a sidebar do PCM
- **Quando** o operador olha os grupos
- **Então** "Tipos de Tarefa" aparece no grupo CONFIGURAÇÕES, não mais em CADASTROS; a tela
  (`view: "tipos-tarefa"`) abre igual.

### AC-2: "PMOC" em Operação (item 7)
- **Dado** a sidebar do PCM
- **Quando** o operador olha o grupo OPERAÇÃO
- **Então** "PMOC" aparece ali (`view: "pmoc"`, mesma `PmocPage`), acessível junto do resto da operação.

### AC-3: Grupo Preventivo removido (item 8)
- **Dado** a sidebar do PCM
- **Quando** o operador procura "Preventivo"/"Cronograma"/"Preventivas"
- **Então** o grupo PREVENTIVO não existe mais; os itens mortos Cronograma e Preventivas somem
  (seu conteúdo real continua dentro do PMOC, em abas).

### AC-4: Nada quebrado
- **Dado** as telas que continuam (PMOC, Tipos de Tarefa)
- **Quando** abertas pelos novos lugares
- **Então** funcionam igual; nenhum `view` órfão, nenhuma rota apontando pra item removido.

## Casos de borda e erros
- Confirmar que Cronograma/Preventivas realmente não têm tela própria antes de remover (têm não —
  confirmado, sem `view:`). Se algum `view` referenciar "preventivas" em outro lugar, tratar.
- Deep-link/estado `pcmView` salvo em "pmoc"/"tipos-tarefa" continua válido (só mudou o grupo visual).

## Fora de escopo
- Mexer no conteúdo do PMOC (abas cronograma/preventivas internas ficam).
- Remover a coluna virtual "Preventiva" do Kanban (é outra coisa — preventivas do board, não este
  item de nav morto).

## Rastreabilidade
- Código: `apps/web/src/app/HomePage.tsx` (`PCM_NAV`), testes de nav (`visual-v1.test.ts` e afins).
- Estende: E01-S80 (organização da nav PCM), E01-S114 (reorg anterior).
- ADRs relacionados: —
