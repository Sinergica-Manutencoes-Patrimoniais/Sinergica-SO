---
name: adr-0016-agente-entrevistador-escreve-cadastro-pcm
description: Agente de Atendimento conduz entrevista e escreve cadastro/estrutura em PCM via caso de uso, sempre após confirmação humana.
alwaysApply: false
---

# ADR-0016 — Agente entrevistador (Atendimento) escreve cadastro em PCM após confirmação

**Status:** Proposto
**Data:** 2026-07-28
**Decisores:** Lucas Azevedo, Fabrício Medeiros, @architect, @prompt-engineer
**Relacionados:** E02-S26 (spec/design/product), ADR-0009 (hierarquia de localização de ativos)

## Contexto
Cadastrar cliente e estrutura de locais (árvore torre/andar/sala) é manual e lento. Quer-se um
agente conversacional que entrevista o colaborador e propõe os cadastros. Isso cria uma fronteira
nova: um componente do bounded context **Atendimento** que **escreve** dados de **PCM** (clientes +
localização). A regra de dependência do projeto proíbe features de domínios diferentes se importarem
diretamente.

## Decisão
- O agente entrevistador vive em **Atendimento** e conduz um **roteiro configurável** de perguntas.
- Ele **não escreve direto** nas tabelas de PCM: a gravação passa por um **caso de uso/porta** de
  PCM (application), respeitando `interfaces → application → domain ← infrastructure` e o isolamento
  entre features.
- **Nenhuma gravação ocorre sem confirmação humana** do entrevistado. A proposta é revisável/ajustável
  antes do "confirma". A gravação é **transacional** (tudo ou nada) e **auditada** em `audit.*`.
- A estrutura de locais segue a hierarquia de **ADR-0009** (até ~3 níveis).
- O **cadastro manual permanece** como caminho soberano; o agente é acelerador, não substituto.

## Alternativas consideradas
| Alternativa                                      | Prós | Contras | Por que (não) escolhida |
|--------------------------------------------------|------|---------|-------------------------|
| A (escolhida) Atendimento escreve via caso de uso de PCM, com confirmação | respeita fronteiras; seguro; auditável | mais indireção | escolhida |
| B Atendimento escreve direto nas tabelas de PCM  | menos código | viola regra de dependência; sem fronteira clara | rejeitada |
| C Mover o entrevistador para dentro de PCM       | escrita local | mistura conversacional/LLM no core de PCM | rejeitada |

## Consequências
**Positivas:**
- Onboarding rápido preservando fronteiras de domínio e auditoria.
- Confirmação obrigatória evita dados errados gravados por LLM.

**Negativas / trade-offs aceitos:**
- Indireção extra (porta de PCM chamada por Atendimento).
- Peças novas a manter (roteiro configurável, estado de entrevista, tela de confirmação).
- Depende de o sentido de "área do cliente" (fala do Fabrício) ser confirmado como o registro do
  cliente no PCM — a Área do Cliente externa (portal) foi descartada (item 14 da reunião).
