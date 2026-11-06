---
name: "docs-adr-0316-correcao-modo-proposta-md"
description: "Documento Sinérgica SO: ADR-0316 — Correção auditada do modo de faturamento"
alwaysApply: false
---

# ADR-0316 — Correção auditada do modo de faturamento

Status: proposta; gate fechado, revisão e testes pendentes.

A correção cria revisão imutável e não modifica a escolha inicial. Exige autorização financeira, versão esperada, motivo e bloqueio da proposta. Para não reinterpretar faturamento passado, é recusada se houver candidato ativo ou qualquer alocação histórica conhecida, mesmo estornada; também requer reconciliação de origens legadas desconhecidas antes da ativação. Retry é idempotente. O trigger usa a última revisão ao validar novas origens, mantendo exclusividade. Não cria candidato, cobrança ou lançamento. Testar concorrência, fechamento, origens legadas e autorização antes de ativar.
