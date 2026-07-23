---
name: spec-E04-S10-impostos-simples-nacional
description: Contrato — provisão de impostos sobre faturamento (Simples Nacional/DAS): alíquota efetiva por competência, valor a recolher e impacto na projeção/resultado.
alwaysApply: true
tier: pequeno
---

# Spec — Impostos / Simples Nacional (provisão DAS)

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S01** (lançamentos/competência) e
> **E04-S04** (receita/faturamento). Origem: pedido do Lucas — resultado "real" exige o imposto.

## Resumo
O Financeiro passa a **provisionar o imposto sobre o faturamento** (Simples Nacional / DAS): dada a
receita do mês (competência) e a alíquota, calcula o valor a recolher, projeta o vencimento e reflete
o imposto no resultado — para o dono ver o lucro **depois de imposto**, não só o bruto.

## Contexto atual (AS-IS)
- `financeiro.lancamentos.data_competencia` já existe (regime de competência, design.md:78).
- Seed de categorias já tem "Impostos e taxas" (design.md:100).
- Receita por competência vem dos lançamentos de entrada / contratos (E04-S04).

## Critérios de aceite

### AC-1: Configurar regime/alíquota
- **Dado** um `superadmin`/financeiro em Configurações → Impostos
- **Quando** define o regime (Simples Nacional) e a alíquota efetiva (fixa ou por faixa/anexo)
- **Então** a configuração é persistida e rege o cálculo.

### AC-2: Provisão por competência
- **Dado** a receita de um mês (competência)
- **Quando** o mês fecha / a provisão é calculada
- **Então** o sistema calcula o imposto a recolher (receita × alíquota efetiva), cria um pagável
  previsto (categoria Impostos) com vencimento na data legal (ex.: dia 20 do mês seguinte).

### AC-3: Alíquota efetiva por faixa (RBT12)
- **Dado** o Simples usa faixa por receita bruta acumulada 12m (RBT12)
- **Quando** a alíquota é por faixa
- **Então** o sistema deriva a alíquota efetiva a partir da RBT12 (receita acumulada), não só uma taxa
  fixa — configurável; fallback para alíquota fixa se o PO preferir simplicidade.

### AC-4: Impacto no resultado/projeção
- **Dado** a provisão de imposto
- **Quando** o dashboard/projeção calcula
- **Então** o imposto entra como saída prevista na projeção de caixa (E04-S05) e reduz o resultado
  líquido.

## Casos de borda e erros
- Receita zero no mês → sem provisão.
- Alíquota não configurada → não calcula, avisa (não inventa taxa).
- Retificação de receita do mês → recalcula a provisão daquela competência (auditável).

## Fora de escopo (vinculante)
- Apuração fiscal oficial / emissão do DAS (é obrigação acessória externa — aqui é **provisão
  gerencial**, não substitui a contabilidade).
- Outros regimes (Lucro Presumido/Real) além do configurável básico — evolução futura.
- Retenções por nota (ISS retido etc.) — futuro, liga com NF-e.

## Rastreabilidade
- Migration: config de impostos (regime/alíquota/faixas) + geração de pagável de imposto por competência
- Domínio: cálculo de alíquota efetiva (RBT12) + provisão (função pura)
- `apps/web/src/features/financeiro/` (Configurações → Impostos + reflexo na projeção)
- Fontes: `financeiro.lancamentos` (receita por competência), categoria "Impostos e taxas"
