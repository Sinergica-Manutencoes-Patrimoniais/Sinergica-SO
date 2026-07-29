---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Agenda do Técnico: horário de início e fim

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Item 8. **Estende E01-S104.**

## Contexto de código
- `pcm.agenda_tecnico` (migration `0155`) tem só `hora time` (um horário só). A referência visual
  original (foto da reunião) já mostrava só "técnico + local" por dia, sem horário — o Lucas agora
  pede intervalo (início/fim), não só um horário pontual.

## Resumo
`agenda_tecnico.hora` vira `hora_inicio` + `hora_fim` (fim opcional — nem toda alocação tem duração
definida).

## Critérios de aceite

### AC-1: Campos de horário de início e fim
- **Dado** o modal de alocação (`AlocacaoModal`, `AgendaTecnicoPage.tsx`)
- **Quando** o operador preenche
- **Então** existem dois campos de hora: início (opcional, como já era) e fim (opcional).

### AC-2: Fim não pode ser antes do início
- **Dado** os dois campos preenchidos
- **Quando** o operador tenta salvar com fim < início
- **Então** o formulário bloqueia com mensagem clara, sem round-trip ao banco.

### AC-3: Card do board mostra o intervalo
- **Dado** uma alocação com início e fim preenchidos
- **Quando** o board semanal renderiza o card
- **Então** mostra "HH:MM–HH:MM"; só início preenchido mostra só a hora (como já era); nenhum dos
  dois preenchido não mostra horário (como já era).

## Casos de borda e erros
- Só fim preenchido, sem início → tratar como inválido (mesma regra de AC-2, ou exigir início
  quando fim for informado).

## Fora de escopo
- Checagem de conflito de horário entre alocações (fora de escopo desde E01-S104 original).

## Rastreabilidade
- Código: migration `0155` (nova migration aditiva pra renomear/adicionar coluna),
  `domain/agenda-tecnico.ts`, `AgendaTecnicoPage.tsx`.
- Estende: E01-S104.
- ADRs relacionados: —
