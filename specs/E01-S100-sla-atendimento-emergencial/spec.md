---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Categoria "Atendimento Emergencial" com SLA de 2h

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 10.

## Resumo
Introduzir o conceito de **Atendimento Emergencial**: chamados/OS marcados como emergenciais têm
SLA de **2 horas** para o técnico estar no local. Segundo o Fabrício, este é o **único SLA que ele
compromete com o cliente**; os demais tipos (C1/C2/P1/P2/IN) permanecem como métrica interna, sem
compromisso contratual de SLA.

## Contexto de código
- E01-S07 (Hub de OS) já tem `calcularPrazoSlaOs` com janelas por `tipo_os` (C1/C2/P1/P2/IN:
  4h/72h/janelas ±3–7d). Esta story **estende** esse mecanismo, não cria SLA do zero.
- **Decidido (Lucas, 2026-07-28): Emergencial é um `tipo_os` novo**, não uma flag ortogonal.
  `CategoriaOs` já tem o valor `"emergencial"` (`abertura-os.ts`, label "Atendimento Emergencial") e
  `inferirTipoOsHub` já mapeia essa categoria para `tipo_os = "C1"` (`hub-os.ts:25`) — hoje o
  emergencial cai dentro do C1 (SLA 4h). Esta story separa: `TipoOsHub` ganha um valor próprio
  (`"EM"`) para emergencial, com seu SLA dedicado de 2h, distinto do C1 (que continua 4h para
  corretivas urgentes não-emergenciais).

## Critérios de aceite

### AC-1: Categoria "emergencial" gera `tipo_os = "EM"`, não mais `"C1"`
- **Dado** um chamado/OS com categoria `"emergencial"` (já existente, `abertura-os.ts`)
- **Quando** `inferirTipoOsHub` calcula o tipo do Hub
- **Então** o resultado é `"EM"` (novo valor de `TipoOsHub`), não mais `"C1"`; **e** o badge de tipo
  na UI mostra "Emergencial" distinto de "C1".

### AC-2: SLA de 2h a partir da abertura
- **Dado** um chamado/OS com `tipo_os = "EM"`
- **Quando** `calcularPrazoSlaOs` calcula o prazo
- **Então** o prazo é **2 horas contadas a partir da data de abertura** do chamado (não 4h como C1);
  **e** o prazo aparece na UI com contagem/estado (dentro do prazo / atrasado).

### AC-3: Emergencial tem precedência de exibição
- **Dado** a fila/lista de chamados e OS
- **Quando** há itens emergenciais
- **Então** eles são destacados (ordenação/priorização e badge) acima dos não-emergenciais.

### AC-4: Demais tipos sem compromisso de SLA com cliente
- **Dado** um chamado não-emergencial
- **Quando** exibido
- **Então** seu SLA (se houver) é tratado como **métrica interna** — não é apresentado como
  compromisso contratual; nenhum alerta "violação de SLA com cliente" é disparado para não-emergenciais.

## Casos de borda e erros
- Emergencial sem data de abertura válida → não calcula prazo (não deve acontecer: abertura é sempre
  registrada; se faltar, sinalizar).
- Emergencial que vira OS → o prazo de 2h continua ancorado na **abertura do chamado**, não na
  criação da OS (coerente com E01-S99: chamado é o ID ponta a ponta).
- Reabertura/replanejamento → não reinicia o relógio das 2h (SLA conta abertura → atendimento real).

## Fora de escopo
- Alertas/notificações automáticas de violação de SLA (feature futura de observabilidade).
- Reformular os SLAs internos dos tipos C1/C2/P1/P2/IN.
- As 3 datas do chamado (abertura/planejada/execução) — definidas na E01-S101/E01-S99.

## Rastreabilidade
- Código: `domain/hub-os.ts` (`TipoOsHub`, `inferirTipoOsHub`, `calcularPrazoSlaOs` — E01-S07),
  `domain/abertura-os.ts` (`CategoriaOs`, já tem `"emergencial"`).
- Depende conceitualmente de E01-S99 (abertura como âncora do SLA).
- ADRs relacionados: —
