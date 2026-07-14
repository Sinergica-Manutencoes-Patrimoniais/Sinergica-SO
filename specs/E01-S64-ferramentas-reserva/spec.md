---
name: spec
description: Contrato — reserva de ferramenta por data/período, antes da atribuição efetiva.
alwaysApply: true
---

# Spec — E01-S64 · Reserva de ferramenta por período

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> **Depende de: E01-S63** (unidades individuais). Origem: feedback Fabrício 2026-07-13 — "opção
> de reserva para uma data, período".

## Resumo
Antes de atribuir de fato, o escritório pode **reservar** uma unidade específica (ou "qualquer
unidade disponível desta ferramenta") para um técnico num intervalo de datas futuro — ex.: reservar
o martelete pro dia da visita de terça. A reserva não move a unidade fisicamente; só bloqueia que
outra reserva/atribuição conflite no mesmo intervalo. No dia, o escritório "efetiva" a reserva
(vira atribuição real, AC-2 da S63) ou cancela.

## Critérios de aceite

### AC-1: Criar reserva
- **Dado** um usuário com `pcm='escrita'`
- **Quando** reserva uma ferramenta para um funcionário num intervalo `[data_inicio, data_fim]`
  (fim opcional = mesmo dia)
- **Então** grava `pcm.ferramenta_reservas` (status `pendente`); se apontar unidade específica,
  valida que ela não tem outra reserva/atribuição sobreposta no intervalo; se não apontar unidade
  ("qualquer uma"), valida que há pelo menos 1 unidade livre no pior caso do intervalo

### AC-2: Conflito de reserva
- **Dado** duas reservas tentando usar a mesma unidade em intervalos sobrepostos
- **Quando** a segunda é criada
- **Então** é rejeitada com mensagem clara mostrando o conflito (quem, quando)

### AC-3: Efetivar reserva
- **Dado** uma reserva `pendente` no dia
- **Quando** o usuário efetiva (com a unidade física escolhida, se a reserva era genérica)
- **Então** vira uma atribuição real (S63 AC-2) e a reserva muda para `efetivada`

### AC-4: Cancelar reserva
- **Dado** uma reserva `pendente`
- **Quando** o usuário cancela
- **Então** vira `cancelada`, libera o intervalo para outras reservas

### AC-5: Visão de agenda
- **Dado** reservas futuras
- **Quando** a tela de Ferramentas (ou aba nova) carrega
- **Então** lista as reservas por data, com destaque para as de hoje/amanhã (ação rápida de
  efetivar)

## Fora de escopo
> Vinculante.
- Reserva automática vinculada à OS/agenda do técnico (integração futura — V1 é manual).
- Notificação/lembrete de reserva (WhatsApp etc.) — evolução.

## Rastreabilidade
- Origem: feedback Fabrício 2026-07-13.
- Depende de: `pcm.ferramenta_unidades` (E01-S63/design local).
- Arquivos-âncora: migration nova (`pcm.ferramenta_reservas`), `domain/ferramenta-reservas.ts`,
  `pages/FerramentasPage.tsx` (aba/seção de reservas).
