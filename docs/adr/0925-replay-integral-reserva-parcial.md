---
name: "docs-adr-0925-replay-integral-reserva-parcial-md"
description: "Documento Sinérgica SO: ADR-0925 — Conflito entre replay integral e reserva parcial"
alwaysApply: false
---

# ADR-0925 — Conflito entre replay integral e reserva parcial

## Contexto

As emissões integral e parcial compartilham identidade do documento. Uma chamada integral repetida com o mesmo identificador de uma reserva parcial podia retornar valor inferior ao saldo originalmente selecionado, como se atendesse ao pedido integral. O AC-4 exige repetição consistente e saldo explícito.

## Decisão

Na emissão integral, após a autorização serializada e ao recuperar documento existente, exigir que seu valor seja igual ao saldo observado na seleção vinculada. Valor diferente gera `request_id_conflitante` (23505), sem alterar documento, seleção, saldo ou auditoria. Preservar os demais controles, assinatura e privilégios por `CREATE OR REPLACE`; não abrir gates. Documento parcial continua recuperável pela própria RPC parcial com valor original.

O valor igual não identifica se o pedido original foi integral ou parcial de 100%: o modelo histórico não armazena modalidade. Esta decisão não afirma distinguir tais casos; eventual discriminação por modalidade exige contrato e migração próprios, com tratamento de registros históricos sem inferência.

## Implantação e reversão

Migration aditiva após 1089. Clientes antigos continuam recebendo o mesmo documento para replay integral compatível, mas devem tratar conflito para requisições anteriormente aceitas com valor diferente. Não modificar dados históricos; rollout coordenado e revisão de consumidores necessários. Reverter código somente por nova migration revisada, ciente de que a versão anterior aceita o conflito; não apagar registros.

## Evidências e limites

Teste de regressão em PostgreSQL descartável com funções reais e esquema sintético; não substitui testes no esquema completo, RLS, concorrência, revisão adversarial ou homologação. Sem deploy ou operação real.
