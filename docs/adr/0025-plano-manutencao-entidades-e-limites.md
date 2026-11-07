---
name: adr-0025-plano-manutencao-entidades-e-limites
description: Limites arquiteturais do Plano de Manutenção, Visita, OS e Auvo.
alwaysApply: false
---

# ADR-0025 — Plano de Manutenção, Visita e execução externa

**Status:** Proposta em revisão após Caderno Técnico e definições posteriores; não aceita para implementação.  
**Data:** 2026-10-26  
**Decisores:** Lucas, Fabrício, equipe PCM  
**Relacionados:** ADR-0008, E01-S165 a E01-S170.

## Contexto

Precedência atual: `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md`.
P01/P02/P03 encerradas; escopo amplo pertence ao Plano, alvo à Rotina e feriado depende do modo.
Revisar desenho abaixo antes de implementação; referências às pendências preservam contexto histórico.

O fluxo aprovado exige Plano → Versão → Rotina → Ocorrência preventiva → Chamado
preventivo → uma ou várias OS → Visita → uma tarefa Auvo por OS. A base atual mistura
plano/ocorrência e pressupõe cardinalidades 1:1 que não preservam execução parcial,
validação independente nem agrupamento operacional por Visita.

## Decisão

- PCM continua system of record para planejamento, Visita, despesas, confirmação e validação.
- Auvo continua executor de campo. Sua tarefa representa uma OS, nunca Plano, Chamado ou Visita.
- Plano é versão lógica; uma Versão aprovada preserva escopo, Rotinas e Checklists copiados.
  Alteração futura cria versão com vigência, sem reescrever execução histórica.
- Visita é contêiner próprio de cliente, Posição, janela, equipe, responsável, deslocamento e
  várias OS. `pcm.agenda_tecnico` pode compor disponibilidade, mas não substitui Visita.
- Uma Ocorrência cria um Chamado preventivo; Chamado aceita 1..N OS. Cada OS tem no máximo uma
  tarefa Auvo vigente e execução parcial cria continuação somente com escopo/esforço restantes.
- Geração é idempotente. Chaves de origem e eventos ordenados impedem duplicação por concorrência,
  retry ou entrega Auvo fora de ordem.
- Migrations são aditivas; tabelas novas usam RLS FORCE, autorização no servidor, pgTAP permitido
  e negado, auditoria append-only e preservação explícita de vínculos legados.

## Consequências

- E01-S165 e E01-S166 fundam modelo e calendário; E01-S167 depende de ambos; E01-S168 depende
  de E01-S167. E01-S169 pode iniciar em paralelo, sem execução externa.
- P01/P02 definem somente a política inicial de permissões; P03 define apenas a sequência de
  recorrência após semana suprimida. Nenhuma pendência altera feriado já aprovado.
- Antes de E01-S168, validar em sandbox o contrato Auvo e HMAC dos retornos. Nunca criar tarefa
  real sem liberação operacional expressa do Fabrício.

## Alternativas rejeitadas

- Estender `pcm.agenda_tecnico` como Visita: perde agrupamento, cliente e histórico próprios.
- Fazer Auvo dono de recorrência/agenda: contraria PCM como fonte de verdade e T−24.
- Manter 1:1 Chamado/OS: não representa execução parcial nem múltiplas Visitas.
