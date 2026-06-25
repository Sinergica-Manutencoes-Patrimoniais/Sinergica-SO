---
name: blueprint-financeiro
description: Requirements do módulo Financeiro (faturamento, contas a receber, rentabilidade). Puxe ao planejar specs financeiras.
alwaysApply: false
---

# Blueprint — Financeiro

> Schema Postgres: `financeiro` · Feature: `apps/web/src/features/financeiro/`

## Problema
A Sinérgica não sabia se cada contrato era lucrativo — custo real (MO + materiais + deslocamento)
era desconhecido. Faturamento era manual e sem controle de inadimplência.

## Fluxos e regras de negócio

### Ciclo financeiro de uma OS
1. OS finalizada → custo importado do Auvo (peças + horas) + MO calculada.
2. Custo consolidado por OS e por contrato (período).
3. Nota fiscal gerada (integração com sistema fiscal/NF-e — Mês 3+).
4. Lançamento de conta a receber.
5. Baixa quando pagamento confirmado.

### Rentabilidade por contrato
- Receita: valor do contrato mensal.
- Custo: Σ(custo real de cada OS do período).
- Margem: receita − custo.
- Alerta: contrato com margem negativa por 2 meses consecutivos → sinalizar para revisão.

### Inadimplência
- Prazo de vencimento configurável por cliente.
- Alerta automático: D+3, D+7, D+15 após vencimento.
- Bloqueio de novas OS: opcional por contrato quando em atraso.

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `Fatura` | Documento de cobrança por período por cliente |
| `ContaReceber` | Parcela a receber com data e status |
| `CustoOS` | Custo real de execução de uma OS (MO + materiais + deslocamento) |
| `RentabilidadeContrato` | View calculada: receita − custo por contrato/período |

## Integrações
- **Auvo**: peças consumidas por OS (via webhook de conclusão).
- **PCM**: OS finalizadas → trigger de consolidação de custo.
- **Sistema fiscal (NF-e)**: emissão de notas (Mês 3+, integração a definir).

## Métricas
| Métrica | Definição |
|---------|-----------|
| Margem por contrato | (Receita − Custo) / Receita (%) |
| Inadimplência | Valor em atraso / Total a receber |
| Ticket médio de OS corretiva | Custo médio de OS corretiva |
