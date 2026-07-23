---
name: spec-E04-S13-cockpit-financeiro-dono
description: Contrato — cockpit financeiro do dono: indicadores de saúde (runway, ponto de equilíbrio, ticket médio, ranking de margem por cliente, tendências) numa visão executiva.
alwaysApply: true
tier: pequeno
---

# Spec — Cockpit financeiro do dono

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S03/S05/S06** (caixa, projeção, margem).
> Origem: sugestão de dashboard. O dashboard de S03 é operacional/caixa; este é a **visão executiva**
> do dono. Nota: dialoga com o épico Gestão/Cockpit (E08) — aqui é o recorte financeiro.

## Resumo
Uma tela executiva de **saúde financeira** para o dono decidir rápido: quanto tempo de caixa resta
(runway), ponto de equilíbrio, ticket médio, ranking de margem por cliente e tendências — tudo
derivado do que S03/S05/S06 já produzem.

## Contexto atual (AS-IS)
- Caixa/projeção: E04-S03/S05. Margem por cliente/contrato: E04-S06 (`rentabilidade_cliente_mes`).
- Cockpit do dono (multi-módulo) é E08 (blueprint `08-gestao-cockpit.md`) — esta story entrega só o
  bloco financeiro, reusável depois pelo E08.

## Critérios de aceite

### AC-1: Runway / fôlego de caixa
- **Dado** o saldo atual e o burn médio (saídas − entradas recorrentes)
- **Quando** o cockpit abre
- **Então** mostra por quantos meses o caixa dura no ritmo atual (runway), com sinalização se abaixo
  de um limiar configurável.

### AC-2: Ponto de equilíbrio
- **Dado** custos fixos e margem de contribuição
- **Quando** o cockpit calcula
- **Então** mostra o faturamento necessário para empatar no mês (break-even) e onde o mês atual está
  em relação a ele.

### AC-3: Ranking de margem por cliente
- **Dado** a margem por cliente (E04-S06)
- **Quando** o cockpit abre
- **Então** lista os clientes por margem (melhores e piores), destacando os de margem negativa
  (alerta 2 meses consecutivos, reusando E04-S06).

### AC-4: Ticket médio e tendências
- **Dado** receita e nº de OS/contratos no período
- **Quando** o cockpit abre
- **Então** mostra ticket médio e tendência (mês a mês) de receita, resultado e inadimplência.

### AC-5: Só gestão
- **Dado** o cockpit
- **Quando** acessado
- **Então** é gated para `superadmin`/gestão; não expõe dado a papéis sem o módulo.

## Casos de borda e erros
- Dados insuficientes (poucos meses) → indicadores marcam "amostra pequena", não mentem.
- Burn negativo (lucrativo) → runway "infinito"/saudável, sem divisão por zero.

## Fora de escopo (vinculante)
- Cockpit multi-módulo completo (é E08).
- Projeções por cenário (what-if) — evolução futura.

## Rastreabilidade
- Domínio: indicadores (runway, break-even, ticket médio) — funções puras
- RPC server-side agregando E04-S03/S05/S06 (`rentabilidade_cliente_mes`, projeção, caixa)
- `apps/web/src/features/financeiro/` (tela Cockpit) — gráficos via skill `dataviz`
- Reusa alerta de margem negativa de E04-S06; bloco reaproveitável pelo E08 (Gestão)
