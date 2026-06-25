---
name: runbook-template
description: Template de runbook (incidente recorrente). Copie para runbooks/<slug>.md ao mapear um incidente.
alwaysApply: false
---

# Runbook — <nome do incidente>

> Runbook é procedimento de emergência: alguém de plantão deve resolver seguindo isto **sem
> precisar pensar**. Crie um quando um incidente já aconteceu ou é previsível (não para hipóteses).

## Cenário
<Quando este runbook se aplica.>

## Sintomas
- <O que se observa: erro X, alerta Y, métrica Z fora do limite.>

## Diagnóstico rápido
1. <Onde olhar primeiro (log, dashboard, query).>
2. <Como confirmar a causa.>

## Procedimento
1. <Passo 1.>
2. <Passo 2.>

## Validação (resolvido?)
- [ ] <Como confirmar que voltou ao normal.>

## Rollback / mitigação
- <Como reverter se o procedimento piorar.>

## Autoridade e SLA
- Quem executa: <agente/pessoa>. Quem pode acionar: <…>.
- SLA: detecção → ação em <X min>; resolução em <Y min>.

## Pós-incidente
- Registrar o que houve; criar story de investigação se a causa-raiz não foi resolvida.
