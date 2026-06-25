---
name: blueprint-gestao-cockpit
description: Requirements do módulo Gestão / Cockpit do Dono (dashboards, SLA, produtividade). Puxe ao planejar specs de dashboard.
alwaysApply: false
---

# Blueprint — Gestão (Cockpit do Dono)

> Schema Postgres: (views sobre `pcm`, `financeiro`, `comercial`) · Feature: `apps/web/src/features/gestao/`

## Problema
Fabrício (dono) não tinha visibilidade em tempo real da operação — SLA, produtividade por técnico,
rentabilidade por contrato, backlog total. Decisões eram tomadas no escuro.

## Visão e KPIs principais

### Operacional (PCM)
| KPI | Definição |
|-----|-----------|
| SLA de atendimento | Tempo abertura → despacho; despacho → execução; execução → fechamento |
| % preventivo cumprido | OS preventivas realizadas / planejadas no período |
| Backlog total (horas) | Soma de esforço estimado de todos os backlog items pendentes |
| Produtividade por técnico | OS finalizadas / período; horas úteis vs deslocamento |

### Financeiro
| KPI | Definição |
|-----|-----------|
| Receita recorrente (MRR) | Soma dos contratos ativos |
| Margem por contrato | (Receita − Custo) / Receita |
| Inadimplência | % do MRR em atraso |

### Comercial
| KPI | Definição |
|-----|-----------|
| Funil de vendas | Leads por fase; taxa de conversão |
| Ticket médio | Valor médio de contrato fechado |

## Implementação
- Todas as telas de Gestão são **read-only** (sem mutação de dados — só visualização via views).
- Dados agregados em views Postgres por domínio (sem joins em runtime — materializar se necessário).
- Gráficos: Recharts ou similar — componentes em `packages/ui/`.

## Acesso
- Exclusivo para `admin` (Fabrício e equipe de gestão).
