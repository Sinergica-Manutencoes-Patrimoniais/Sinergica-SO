---
name: "adr-1685-nao-regravar-campos-na-mudanca-dia-em-lote"
description: "Evita disparar validações de posição para campos preservados na reprogramação S166"
alwaysApply: false
---

# ADR-1685 — Campos preservados na mudança de dia em lote

## Estado

Aceito para implementação no candidato S166. Complementa ADR-1683/1684 na atualização das Visitas; não abre gates, não aumenta o teto de 500 nem autoriza PASS, homologação, merge ou deploy.

## Contexto

O ensaio de 501 Visitas ainda excedeu o timeout de 8 segundos após a confirmação em conjunto e a otimização dos locks. A migration atual inclui `area_id`, `local_id` e `fuso` no `SET` com seus valores atuais. Isso aciona `sso_visita_posicao` em cada linha. A mudança de dia preserva área, Local, responsável, deslocamento e fuso; `sso_mudanca_dia_v2_conjunto` só inclui Visita quando `v.fuso=r.fuso`. A RPC já confere responsável e posição em conjunto e mantém locks `FOR SHARE` dessas referências.

## Decisão

- Atualizar apenas `inicio_em`, `fim_em`, `revisao`, `updated_at` e `updated_by` na confirmação em lote.
- Preservar `area_id`, `local_id`, `fuso`, `responsavel_id` e `deslocamento_minutos` sem incluí-los no `SET`; mantê-los no snapshot, evento de auditoria e payload do comando idempotente.
- Manter a validação e os locks `FOR SHARE` de responsável, Local e Área antes da escrita. Manter os triggers de identidade e todos os outros triggers; não desabilitar trigger ou constraint.
- Preservar a mesma transação, validação de revisão/estado, autorização, valores de início/fim, auditoria, replay e erros de concorrência.

## Consequências

A validação de posição não é repetida para campos que a operação não modifica. O lote integrado deve provar equivalência do estado e dos artefatos de auditoria/comando, ausência de escrita parcial, proteção das referências e desempenho no clone descartável. Se qualquer referência puder mudar entre validação e confirmação, ou se a equivalência falhar, manter a validação via trigger ou reverter esta otimização. Revisão adversarial continua obrigatória antes de PASS arquitetural.
