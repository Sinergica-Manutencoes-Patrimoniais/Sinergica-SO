---
name: spec-E09-S07-portal-cronograma-conformidade
description: Contrato — no portal, cronograma de preventivas (PMOC) do condomínio + painel de conformidade legal (ART/PMOC/laudos vigentes × vencidos).
alwaysApply: true
tier: pequeno
---

# Spec — Cronograma de preventivas + conformidade

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01 e da suíte PMOC (E01-S03..S08).
> (Ideia nova aprovada pelo PO.)

## Resumo
O síndico vê o **calendário das preventivas agendadas** (cronograma PMOC) do seu condomínio e um
**painel de conformidade legal**: o que está vigente × vencendo × vencido (ART, PMOC, laudos). Valor
de risco/seguro pro síndico.

## Contexto atual (AS-IS)
- PMOC: `pcm.pmoc_contracts` (ART/vigência/responsável técnico), cronograma de 12 visitas por
  contrato (E01-S03/S07), status de visita atrasada (cron `pmoc_daily_status`, E01-S05). Painel
  interno "Precisa de atenção" já categoriza urgência (E01-S08).

## Critérios de aceite

### AC-1: Cronograma de preventivas do condomínio
- **Dado** um síndico logado
- **Quando** abre o Cronograma
- **Então** vê as visitas preventivas planejadas/realizadas do **seu** condomínio (data, tipo,
  status), escopadas por `cliente_id`.

### AC-2: Painel de conformidade
- **Dado** ART/PMOC/laudos do condomínio
- **Quando** o síndico abre Conformidade
- **Então** vê cada item com status **vigente / vencendo / vencido** (datas de vigência), destacando o
  que exige atenção — sem dado interno de custo.

### AC-3: Escopo e read-only
- **Dado** os dados PMOC de vários clientes
- **Quando** o síndico consulta
- **Então** só vê os do seu condomínio (RLS `cliente_id`); tudo read-only.

### AC-4: Estado vazio
- **Dado** condomínio sem contrato PMOC/laudos
- **Quando** as seções abrem
- **Então** estado vazio claro.

## Fora de escopo (vinculante)
- Agendar/alterar visitas (é interno).
- Notificar vencimento (é E09-S08).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (Cronograma + Conformidade)
- Fontes PMOC: `pcm.pmoc_contracts`, cronograma/visitas (E01-S03/S07), laudos (E01-S05/S19)
- Reusa domínio de urgência/vigência (E01-S08 `contratosComAlerta`) adaptado ao portal
- RLS por `cliente_id` nas tabelas PMOC
