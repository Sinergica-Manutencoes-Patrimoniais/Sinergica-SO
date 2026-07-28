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
- **Pergunta a resolver na implementação:** "Atendimento Emergencial" é (a) um `tipo_os`/categoria
  novo, ou (b) uma flag/criticidade ortogonal ao tipo. Recomendação: flag de **criticidade
  emergencial** ortogonal, pois um emergencial pode ser corretivo (C1). Confirmar com o `@architect`
  se virar decisão de schema.

## Critérios de aceite

### AC-1: Marcar chamado/OS como emergencial
- **Dado** um chamado em tratamento (ou uma OS)
- **Quando** o operador marca como "Atendimento Emergencial"
- **Então** o registro passa a ter criticidade emergencial persistida e visível na UI (badge).

### AC-2: SLA de 2h a partir da abertura
- **Dado** um chamado marcado como emergencial
- **Quando** o SLA é calculado
- **Então** o prazo é **2 horas contadas a partir da data de abertura** do chamado; **e** o prazo
  aparece na UI com contagem/estado (dentro do prazo / atrasado).

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
- Código: `apps/web/src/features/pcm/` (Hub de OS — `calcularPrazoSlaOs`, E01-S07).
- Depende conceitualmente de E01-S99 (abertura como âncora do SLA).
- ADRs relacionados: revisitar se "emergencial" virar `tipo_os` novo (schema).
