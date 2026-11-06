---
name: "docs-adr-1235-interface-lote-rascunhos-md"
description: "Documento Sinérgica SO: ADR-1235 — Interface de lote de rascunhos legados"
alwaysApply: false
---

# ADR-1235 — Interface de lote de rascunhos legados

## Decisão

Preparar interface experimental que seleciona Planos carregados, consulta fotografia autorizada de cada origem e exige escolhas explícitas de recorrência e tolerâncias. Aceite e criação usam IDs estáveis e tentativa persistida na aba. Antes de retirar a tentativa, interface confere sessão, recibo e conteúdo armazenado. Autenticados recebem acesso somente às duas funções mediadas do ADR-1234; gates permanecem fechados e autorização atual continua no servidor.

## Limites

Interface não prova aceite da migração completa, equivalência, histórico ou reversão por lote. Armazenamento temporário contém fotografias e deve ser revisado quanto a privacidade e tamanho. Validar lote parcial, troca de sessão/Cliente, concorrência, múltiplas abas, resposta perdida, autorização, rollback e revisão adversarial antes de habilitar; nenhuma migração real é autorizada.
