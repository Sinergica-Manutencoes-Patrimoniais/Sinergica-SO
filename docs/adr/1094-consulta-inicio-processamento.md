---
name: "docs-adr-1094-consulta-inicio-processamento-md"
description: "Documento Sinérgica SO: ADR-1094 — Consulta do início observado de processamento"
alwaysApply: false
---

# ADR-1094 — Consulta do início observado de processamento

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar consulta autenticada por Cliente e item da outbox para devolver o estado local e o início observado da tentativa, quando disponível. A leitura valida o dono atual de Sistema ou Componente e não expõe erro bruto, payload ou credenciais. O horário não prova que o processamento está abandonado nem autoriza retentativa.

## Limites

Itens já em processamento antes da migration anterior terão início desconhecido; relógio de enfileiramento não o substitui. Não há prazo universal nem lease implementado. Testar revogação, troca de Cliente, lock, RLS/FORCE, privacidade e revisão adversarial antes de concessão e ativação.
