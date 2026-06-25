---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — <nome da feature>

> **Tier:** arquitetural · **Status:** rascunho | em review | aprovado
> **Autor:** <nome> · **Revisores:** <nomes> · **Data:** <YYYY-MM-DD>
> Responde: **como** no nível de sistema. **Obrigatório no tier arquitetural** (não crie em tier
> menor — ver `ANTI-PADROES.md`).

## Contexto da funcionalidade
<Estado atual, restrições, por que agora. Link para `product.md`.>

## Goals / Non-goals
**Goals**
- <objetivo técnico mensurável>

**Non-goals**
- <fora de escopo deste design>

## Design proposto
<A solução. Diagramas (C4/sequência em Mermaid), componentes, fluxo de dados, contratos de API,
modelo de dados. Mostre as fronteiras com os bounded contexts existentes.>

## Cobertura dos 5 eixos
> Toda decisão técnica passa pelos 5 eixos. Preencha o que toca; marque "sem impacto" no resto.
> Decisão estrutural em qualquer eixo → vira ADR.

### 1. Tech stack
<Linguagens, frameworks, libs/serviços novos. Versões. Diverge do padrão? Justifique.>
### 2. Arquitetura base
<Como encaixa nas camadas DDD e bounded contexts. Nova fronteira? Novos agregados/portas?>
### 3. Infra
<Recursos novos (fila, cache, banco), ambientes, IaC, custo. Deploy, feature flag, reversão segura.>
### 4. Qualidade
<Estratégia de teste e o que cobre os AC (pirâmide: unidade/integração/contrato/E2E —
`testes/README.md`). **Budget de performance** do fluxo (`performance/README.md`): p95, query
indexada, paginação. Gates: cobertura, contract test, performance, segurança.>
### 5. Observabilidade
<Métricas, logs estruturados (`observabilidade/README.md`), tracing, alertas. SLO/SLI
(`observabilidade/slo-sli.template.md`). Como a telemetria prova que funciona?>

## Mapa de dependências
| Dependência          | Tipo        | Descrição                | Métodos / endpoints                   |
|----------------------|-------------|--------------------------|---------------------------------------|
| <ex.: API Pagamentos>| REST / gRPC | <cobra e estorna cartão> | `POST /charges` · `GET /charges/{id}` |

## Alternativas consideradas
| Alternativa   | Prós | Contras | Por que (não) escolhida |
|---------------|------|---------|-------------------------|
| A (escolhida) |      |         |                         |
| B             |      |         |                         |

## Trade-offs e consequências
<O que ganhamos e o que aceitamos perder. Dívida técnica assumida conscientemente.>

## Riscos
| Risco   | Descrição          | Prob. × Impacto | Ações / mitigações           |
|---------|--------------------|-----------------|------------------------------|
| <risco> | <por que acontece> | médio × alto    | <o que fazer / como mitigar> |

## Roadmap da feature
| Fase / onda | Entrega            | Quando         | Depende de |
|-------------|--------------------|----------------|------------|
| 1 (MVP)     | <fatia que valida> | <ciclo/sprint> | —          |
| 2           | <incremento>       | <depois>       | 1          |

## Questões em aberto
- [ ] <decisão pendente — quem responde, até quando>

> Decisões difíceis de reverter tomadas aqui → registre como ADR em `docs/adr/`.
