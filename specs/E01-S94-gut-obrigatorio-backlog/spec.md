---
name: spec-E01-S94-gut-obrigatorio-backlog
description: Contrato — GUT obrigatório ao enviar Chamado pro Backlog.
alwaysApply: true
tier: pequeno
---

# Spec — GUT obrigatório ao enviar Chamado pro Backlog

> **Fonte da verdade.** Status: aprovado
> Origem: apontamento de Lucas (2026-07-22), `docs/Apontamentos/Apontamentos-Fabricio-Aline.md`.
> "Ao enviar um Chamado para o Backlog, o preenchimento da matriz GUT deve ser obrigatório. Sem os
> valores de Gravidade, Urgência e Tendência, não é possível priorizar corretamente o Chamado. O
> sistema deve bloquear o envio enquanto o GUT não estiver completo."

## Resumo
Hoje o modal "Enviar ao backlog" (`GerarOsModal` em `ChamadosPage.tsx`) não pede Gravidade/
Urgência/Tendência ao usuário — `confirmarGerarOs` envia os três campos hardcoded como `3` (ver
`ChamadosPage.tsx:105-107`). Sem escolha real do usuário, o item cai no Backlog GUT com prioridade
sempre igual, quebrando a priorização (`E01-S01`/`E01-S82`). Esta story adiciona os 3 campos ao
modal, obrigatórios apenas quando `destino === "backlog"`, e bloqueia a confirmação até estarem
preenchidos.

## Critérios de aceite

### AC-1: Campos GUT visíveis só no fluxo backlog
- **Dado** o usuário abre o modal a partir de "Enviar ao backlog"
- **Quando** o modal renderiza
- **Então** aparecem 3 seletores (Gravidade, Urgência, Tendência, escala 1-5), sem valor
  pré-selecionado.

### AC-2: Bloqueio sem GUT completo
- **Dado** o modal em modo "Enviar ao backlog"
- **Quando** algum dos 3 campos GUT não está preenchido
- **Então** o botão "Confirmar" fica desabilitado.

### AC-3: Fluxo "Gerar OS" não muda
- **Dado** o modal em modo "Gerar OS" (`destino === "convertido_os"`)
- **Quando** o modal renderiza
- **Então** os campos GUT não aparecem e o comportamento existente (GUT default 3/3/3) é mantido —
  fora de escopo desta story mudar o fluxo de conversão direta em OS.

### AC-4: Valores GUT chegam corretos na OS criada
- **Dado** o usuário preenche G/U/T e confirma "Enviar ao backlog"
- **Quando** a OS é criada
- **Então** `gravidade`/`urgencia`/`tendencia` gravados são os valores escolhidos pelo usuário, não
  `3` fixo.

## Fora de escopo (vinculante)
- Mudar o fluxo "Gerar OS" (conversão direta, `destino === "convertido_os"`).
- Mudar a fórmula de priorização GUT/GUTD (`E01-S01`/`E01-S82`) — só a captura do dado na origem.

## Rastreabilidade
- `apps/web/src/features/pcm/pages/ChamadosPage.tsx` (`GerarOsModal`, `confirmarGerarOs`)
