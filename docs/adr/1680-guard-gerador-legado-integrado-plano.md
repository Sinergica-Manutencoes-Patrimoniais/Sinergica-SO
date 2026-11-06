---
name: adr-1680-guard-gerador-legado-integrado-plano
description: Coordenação do gerador legado com o estado atual do Plano SSO.
alwaysApply: false
---

# ADR-1680 — Guard do gerador legado integrado ao Plano SSO

## Estado

Proposta pendente de revisão arquitetural, ensaio em banco descartável e homologação. Não autoriza deploy.

## Contexto

Planos em migração podem ter origens apenas no SSO, apenas no legado ou integração comprovada entre os dois. Um gerador legado ativo durante suspensão do Plano SSO poderia recriar ocorrências e ordens que o PCM acredita bloqueadas.

## Decisão

Antes de materializar cada ciclo legado, consultar e bloquear transacionalmente reservas `integrar_ponte` cujo Plano SSO não esteja aprovado e ativo. Preservar as semânticas de `somente_sso` e `somente_legado`. Plano legado sem ponte ou reserva comprovada permanece não atribuível e com impacto desconhecido; não converter nem apagar automaticamente.

## Consequências

O guard precisa compartilhar o bloqueio do ciclo com a suspensão/retomada para impedir corrida entre geração e mudança de estado. A retomada encaminha vencidos para decisão do PCM e não os reemite em massa. Falha de consulta ou mapeamento incompleto deve bloquear a geração integrada.

## Validação pendente

Revisão adversarial, testes pgTAP de modos e escopo, concorrência de geração versus suspensão/retomada e confirmação de que falhas não criam OS ou tarefas no Auvo.
