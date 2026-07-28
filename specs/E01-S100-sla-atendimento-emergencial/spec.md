---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Categoria "Atendimento Emergencial" com SLA de 2h

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 10.

## Resumo
Chamados/OS de categoria "Atendimento Emergencial" têm SLA de **2 horas** para o técnico estar no
local. Segundo o Fabrício, este é o **único SLA que ele compromete com o cliente**; os demais tipos
(C2/P1/P2/IN) permanecem métrica interna, sem compromisso contratual.

## Contexto de código (correção após investigar, 2026-07-28)
- `CategoriaOs` já tem o valor `"emergencial"` (`abertura-os.ts`, label "Atendimento Emergencial").
- `inferirTipoOsHub` já mapeia essa categoria **exclusivamente** para `tipo_os = "C1"`
  (`hub-os.ts:25`) — nenhuma outra categoria vira `"C1"`. Ou seja, **`C1` já é 100% sinônimo de
  Emergencial** (`TIPO_OS_HUB_LABEL.C1 === "Emergencial"`, `hub-os.ts:11`).
- Não existe tipo novo pra criar: **o gap real é só o SLA de C1 estar em 4h e precisar virar 2h**
  (`calcularPrazoSlaOs`, `hub-os.ts:67`). A primeira versão desta spec propôs um `tipo_os` novo
  (`"EM"`) por engano, antes de confirmar que C1 já era exclusivo do emergencial — descartado.

## Critérios de aceite

### AC-1: SLA de C1 (Emergencial) passa de 4h para 2h
- **Dado** um chamado/OS com `tipo_os = "C1"`
- **Quando** `calcularPrazoSlaOs` calcula o prazo
- **Então** o prazo é **2 horas** a partir da data de abertura (era 4h); **e** o prazo aparece na UI
  com contagem/estado (dentro do prazo / atrasado).

### AC-2: Emergencial tem precedência de exibição
- **Dado** a fila/lista de chamados e OS
- **Quando** há itens `tipo_os = "C1"` (Emergencial)
- **Então** eles são destacados (já herdam `calcularPrioridadeHub === 1`, a maior prioridade —
  confirmar que a UI já reflete isso ou reforçar o destaque visual/badge).

### AC-3: Demais tipos sem compromisso de SLA com cliente
- **Dado** um chamado não-emergencial (C2/P1/P2/IN)
- **Quando** exibido
- **Então** seu SLA é tratado como **métrica interna** — não é apresentado como compromisso
  contratual; nenhum alerta "violação de SLA com cliente" é disparado para não-emergenciais.

## Casos de borda e erros
- C1 sem data de abertura válida → não calcula prazo (não deve acontecer: abertura é sempre
  registrada; se faltar, sinalizar).
- Emergencial que vira OS → o prazo de 2h continua ancorado na **abertura do chamado**, não na
  criação da OS (coerente com E01-S99: chamado é o ID ponta a ponta).
- Reabertura/replanejamento → não reinicia o relógio das 2h (SLA conta abertura → atendimento real).

## Fora de escopo
- Alertas/notificações automáticas de violação de SLA (feature futura de observabilidade).
- Reformular os SLAs internos dos tipos C2/P1/P2/IN.
- As 3 datas do chamado (abertura/planejada/execução) — E01-S101/E01-S99.

## Rastreabilidade
- Código: `domain/hub-os.ts` (`calcularPrazoSlaOs`, E01-S07).
- Depende conceitualmente de E01-S99 (abertura como âncora do SLA).
- ADRs relacionados: —
