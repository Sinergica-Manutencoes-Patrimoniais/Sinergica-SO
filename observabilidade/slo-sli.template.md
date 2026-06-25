---
name: slo-sli
description: Template de SLO/SLI para o caminho crítico. Puxe ao definir metas de confiabilidade (perfil OS/serviço crítico).
alwaysApply: false
---

# SLO/SLI — <nome do serviço/fluxo>

> **SLI** = o que você mede. **SLO** = o alvo. **Error budget** = quanto pode falhar antes de
> parar de lançar e focar em estabilidade. Defina só para o **caminho crítico** — não para tudo.
> Dono: `@reliability`. Estrutural → vira ADR.

## Fluxo crítico
<Qual jornada/endpoint. Ex.: "registrar comissão via webhook de venda".>

## Indicadores (SLI) e metas (SLO)
| SLI (como mede)                              | SLO (alvo)        | Janela   | Fonte da medição        |
|---------------------------------------------|-------------------|----------|-------------------------|
| Disponibilidade (req não-5xx / total)       | ≥ 99,9%           | 30 dias  | logs Edge Function/API  |
| Latência p95 da operação                    | < 500 ms          | 30 dias  | logs/telemetria         |
| Sucesso da integração (callbacks ok / total)| ≥ 99,5%           | 30 dias  | tabela de eventos/audit |

## Error budget e política
- Budget = 1 − SLO (ex.: 99,9% → 0,1% ≈ 43 min/mês de indisponibilidade).
- **Budget estourado:** congelar features no fluxo e priorizar confiabilidade até voltar ao alvo.

## Alertas
| Condição                                  | Severidade | Ação / runbook                          |
|-------------------------------------------|------------|-----------------------------------------|
| 5xx > X% por Y min                        | alta       | `runbooks/rollback-deploy.md`           |
| Integração falhando / token expirado      | alta       | runbook da integração; alerta no Teams  |
| Latência p95 > SLO sustentada             | média      | investigar query/índice (`performance/`)|

## Revisão
- Revisar SLO a cada <trimestre> com dados reais. Meta irreal vira ruído; meta frouxa não protege.
