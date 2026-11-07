---
name: "adr-1684-locks-confirmacao-lote-mudanca-dia"
description: "Evita leituras e locks redundantes na confirmação de calendário S166 em lote"
alwaysApply: false
---

# ADR-1684 — Locks da confirmação em lote da mudança de dia

## Estado

Aceito para implementação no candidato S166. Complementa a ADR-1683 somente na aquisição dos locks de composição. Não abre gates, não aumenta o teto de 500 nem autoriza PASS, homologação, merge ou deploy.

## Contexto

O ensaio isolado da confirmação com 501 Visitas terminou em `57014` após aproximadamente 8 segundos. A migration 1828 já substituía chamadas individuais por operações em conjunto, mas ainda invocava `sso_lock_escritor_composicao` uma vez por Visita. Cada chamada relia o gate e adquiria locks de requisição e escopo. A RPC externa já mantém a linha do gate em `FOR SHARE` e percorre as Visitas em ordem estável antes dos locks de tabela e linha.

## Decisão

- Ler e segurar o gate de composição uma vez, como já faz a confirmação.
- Quando habilitado, adquirir uma vez o lock da requisição da mudança no namespace `visita-request:` e depois adquirir, em ordem crescente de ID, o lock `visita-composicao-scope:` de cada Visita.
- Manter namespaces e ordem de aquisição do protocolo escritor; adquirir todos os locks antes dos locks de tabela e linha.
- Preservar transação única, validações, triggers, auditoria, comandos idempotentes, caminho mediado de feriados, resposta/replay e gates fechados. Não elevar timeout nem dividir gravações para mascarar duração.

## Consequências

A confirmação evita consultas repetidas ao gate e locks de requisição artificiais por Visita, sem remover a proteção de escopo de cada Visita. O lote integrado deve provar desempenho, concorrência com escritores de composição, rollback integral, equivalência de auditoria/comandos e cumprimento do orçamento de lock. Se a prova falhar, reverter a otimização e manter o fluxo acima de 500 bloqueado. A revisão adversarial continua obrigatória antes de PASS arquitetural.
