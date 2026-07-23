---
name: spec-E01-S92-apontamento-horas-visualizacoes
description: Contrato — novas visualizações/indicadores sobre os dados de apontamento de horas (produtividade, consistência de fontes, horas por cliente/técnico).
alwaysApply: true
tier: pequeno
---

# Spec — Visualizações de apontamento de horas

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 5.1. "Traga sugestões de visualizações com base
> no que tem de dados na sessão de apontamento de horas — conto com a criatividade." + toda a
> discussão sobre bater 3 fontes de hora e produtividade (~8h/dia esperadas).

## Resumo
A tela de apontamento de horas ganha um conjunto de **visualizações/indicadores** derivados dos dados
já existentes (horas de OS, início/fim de visita, ponto do funcionário), focados em **produtividade**
e **consistência entre fontes** — os problemas reais que o Fabrício descreveu.

## Contexto atual (AS-IS)
- Apontamento de horas: `apps/web/src/features/pcm/pages/ApontamentoHorasPage.tsx`, domínio
  `domain/apontamento-horas.ts` (+ teste). Dados: horas somadas por OS, e (da call) início/fim de
  visita e ponto do funcionário.
- Fabrício: as 3 fontes (soma de horas de OS · janela início/fim de visita · ponto) **devem bater**
  com tolerância de minutos; desvio = sinal (ex.: OS de 2-4 min = técnico fecha em lote no fim do dia).

## Visualizações propostas (guia — os AC abaixo as tornam contrato)
1. **Produtividade diária por técnico** — horas de OS por dia vs meta (~8h), com desvio destacado.
2. **Consistência das 3 fontes** — por técnico/dia: horas de OS × janela de visita × ponto, com
   sinalização quando divergem além da tolerância.
3. **Anomalias de duração de OS** — lista/heatmap de OS curtas demais (< limiar, ex.: 5 min) que
   sugerem preenchimento em lote.
4. **Horas por cliente/contrato** — total de horas de OS por cliente no período (base de cobrança).

## Critérios de aceite

### AC-1: Produtividade diária por técnico
- **Dado** o período selecionado
- **Quando** a visualização de produtividade renderiza
- **Então** mostra horas de OS por técnico por dia comparadas à meta configurável (default 8h),
  destacando dias abaixo/acima.

### AC-2: Consistência entre as 3 fontes
- **Dado** técnico/dia com horas de OS, janela de início/fim de visita e ponto
- **Quando** a visualização de consistência renderiza
- **Então** exibe as 3 fontes lado a lado e **sinaliza divergência** acima de uma tolerância
  configurável (em minutos). Fonte ausente é mostrada como "sem dado", não zero.

### AC-3: Anomalias de duração
- **Dado** OS com duração registrada
- **Quando** a visualização de anomalias renderiza
- **Então** lista as OS abaixo de um limiar de duração (configurável) como candidatas a
  preenchimento em lote, com técnico/dia/cliente.

### AC-4: Horas por cliente
- **Dado** o período
- **Quando** a visualização por cliente renderiza
- **Então** mostra total de horas de OS por cliente/contrato (base de produtividade/cobrança).

## Casos de borda e erros
- Período sem dados → estado vazio claro.
- Técnico em escritório/sem OS no dia → não conta como anomalia (não é "0h suspeito").
- Todas as visualizações são **read-only** e derivam do dado existente (sem gravar nada).

## Fora de escopo (vinculante)
- Correção/edição das horas (só visualização).
- Integração de novas fontes de dado (usa o que já existe).
- Dashboards de outros módulos.

## Rastreabilidade
- `apps/web/src/features/pcm/pages/ApontamentoHorasPage.tsx`, `domain/apontamento-horas.ts`
- Guia de dataviz: seguir a skill `dataviz` (paleta/acessibilidade) ao construir os gráficos
- Configuráveis (meta de horas, tolerância, limiar de anomalia): Configurações (E01-S80)
