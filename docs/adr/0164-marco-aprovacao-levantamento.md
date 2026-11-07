---
name: "docs-adr-0164-marco-aprovacao-levantamento-md"
description: "Documento Sinérgica SO: ADR-0164 — Marco de aprovação de código por incorporação"
alwaysApply: false
---

# ADR-0164 — Marco de aprovação de código por incorporação

## Contexto

A incorporação de linha de levantamento por PCM já é um evento explícito de decisão; impressão de etiqueta e aprovação de outros fluxos não possuem evento confiável identificado. O registro de ciclo de código da ADR-0138 cobre somente ciclos criados explicitamente e não é inferido para ativos legados.

## Decisão

Preparar gatilho transacional que observa a incorporação oficial de Sistema ou Equipamento/Componente e grava a primeira aprovação no ciclo existente. Reutiliza gate desligado e bloqueio não bloqueante dos marcos de S177. Não cria ciclo e não infere aprovação de nome, status ou mero acesso. Não altera o código público nem chama Auvo.

## Limites

Fluxo de incorporação permanece fechado e não cria ciclo para novos registros. Outros meios de aprovação, emissão/reimpressão de etiqueta e demais marcos ainda precisam de eventos de origem reais; não alegar cobertura total. Verificar locks, ordem com 0359 e demais escritores, autorização, atomicidade e compatibilidade antes da ativação. Sem testes ou aplicação.
