---
name: "docs-adr-1199-lote-calendario-previsao-conferida-md"
description: "Documento Sinérgica SO: ADR-1199 — Conferência do conjunto do lote de calendário"
alwaysApply: false
---

# ADR-1199 — Conferência do conjunto do lote de calendário

## Contexto

O lote 0790 recalcula os ciclos na transação, mas o operador confirma uma prévia externa. Comparar somente a quantidade não detecta troca de ciclo ou vencimento. Alterações entre prévia e execução devem ser explícitas.

## Decisão

Preparar entrada aditiva que receba a lista conferida de pares ciclo/vencimento, até 31 itens. Após executar o comando canônico na mesma transação, compara a lista efetivamente retornada à lista declarada; divergência lança erro e reverte a transação inteira. Gate próprio fechado habilita proteção da entrada anterior para pedidos novos, exigindo token privado transacional; recibos antigos continuam sujeitos à validação integral do núcleo. O comando existente e suas garantias de idempotência são reutilizados.

## Limitações

A comparação não comprova integridade do próprio navegador, completude de feriados ou cobertura de outras fontes. Se o recibo canônico já existir, a entrada compara o recibo anterior e não desfaz resultado já confirmado. Gate fechado; validar definição injetada, implantação coordenada, outros consumidores, tokens, rollback, replay, concorrência, fuso, RLS/FORCE, limites, permissões e revisão adversarial antes de habilitar. Não cria OS ou tarefa Auvo.
