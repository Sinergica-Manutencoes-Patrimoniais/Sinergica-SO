---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório de apontamento de horas: redesign visual e funcional

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 4). "A parte visual do relatório de
> apontamento de horas está tudo bagunçado feio; identifique oportunidades, deixe o layout mais
> bonito e funcional."

## Contexto de código
- `pages/ApontamentoHorasPage.tsx` + `domain/apontamento-horas.ts` (E01-S72 apontamento, E01-S77
  visão diária, E01-S92 visualizações). Dado real de horas por técnico/OS vindo do Auvo/PCM.
- Design system do projeto (tokens `ink`/`line`/`paper`/`card`, componentes `ui/`) — a base pra
  deixar consistente com o resto do SO (mesma pegada de densidade da Operação, E01-S59/S75).

## Resumo
Redesign da tela de apontamento de horas: hierarquia visual clara, agrupamento útil (por técnico /
por dia / por cliente), totais e destaques legíveis, responsivo, consistente com o design system.
Sem inventar dado novo — reorganiza e embeleza o que já é exibido, corrigindo o "bagunçado".

## Critérios de aceite

### AC-1: Hierarquia e leitura claras
- **Dado** a tela de apontamento de horas
- **Quando** o operador abre
- **Então** há hierarquia visual óbvia (cabeçalho/filtros → agrupamentos → linhas), sem
  amontoamento; espaçamento/tipografia consistentes com o design system.

### AC-2: Agrupamento e totais úteis
- **Dado** apontamentos de vários técnicos/dias
- **Quando** exibidos
- **Então** dá pra ver por **técnico**, por **dia** e por **cliente**, com **totais** (horas por
  grupo e total geral) visíveis — não uma lista plana confusa.

### AC-3: Responsivo
- **Dado** telas menores (mobile/tablet)
- **Quando** a página renderiza
- **Então** o layout não estoura horizontalmente (tabela/blocos com scroll próprio quando preciso),
  continua legível.

### AC-4: Sem regressão de dado
- **Dado** os números que a tela já mostrava (horas, OS, técnico)
- **Quando** o redesign entra
- **Então** os mesmos valores aparecem corretos — o redesign é de apresentação, não muda cálculo.

## Casos de borda e erros
- Período sem apontamento: estado vazio claro, não uma tabela quebrada.
- Técnico/cliente sem nome resolvido: fallback ("Sem técnico"), sem furo no layout.
- Muitos registros: virtualização/scroll interno, sem travar.

## Fora de escopo
- Mudar a fonte/cálculo das horas (é redesign de UI).
- Exportar PDF do apontamento (se pedido depois, story própria).

## Rastreabilidade
- Código: `pages/ApontamentoHorasPage.tsx`, `domain/apontamento-horas.ts` (só se precisar de
  agregação nova pra totais), componentes `ui/`.
- Estende: E01-S72/S77/S92 (apontamento de horas).
- ADRs relacionados: —
